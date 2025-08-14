#!/usr/bin/env python3
"""
Django-based Statistics Migration Script

This script uses Django ORM to migrate view count data from an old statistics 
server to a new one. This approach is safer as it uses the same models and 
validation logic as the application.

Requirements:
- Both old and new servers should use the same Django models
- Run this script from the Django project directory
"""

import os
import sys
import django
from django.db import transaction
from datetime import datetime
import argparse

# Add the Django project to the path
sys.path.insert(0, '../statisticsDataServer')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'statisticsDataServer.settings')

django.setup()

# Now we can import Django models
from statisticsDatabase.models import Category, Video, Location, Device

class DjangoStatisticsMigrator:
    def __init__(self, old_db_path, dry_run=False):
        self.old_db_path = old_db_path
        self.dry_run = dry_run
        self.migration_log = []
        
    def log(self, message):
        """Log migration messages"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.migration_log.append(log_entry)
    
    def get_old_data_from_api(self, old_server_url):
        """Alternative method: Get data from old server via API"""
        import requests
        
        self.log(f"Fetching data from old server API: {old_server_url}")
        
        try:
            # Get authentication token (you'll need to implement this based on your auth)
            # auth_response = requests.post(f"{old_server_url}/login/", {
            #     'username': 'your_username',
            #     'password': 'your_password'
            # })
            # token = auth_response.json()['token']
            # headers = {'Authorization': f'Token {token}'}
            
            headers = {}  # If no auth required for reading
            
            # Fetch data from API endpoints
            videos_response = requests.get(f"{old_server_url}/videos/", headers=headers)
            categories_response = requests.get(f"{old_server_url}/categories/", headers=headers)
            locations_response = requests.get(f"{old_server_url}/locations/", headers=headers)
            
            old_data = {
                'videos': videos_response.json(),
                'categories': categories_response.json(), 
                'locations': locations_response.json(),
                'devices': []  # We'll get these per location
            }
            
            # Get devices for each location
            for location in old_data['locations']:
                devices_response = requests.get(f"{old_server_url}/devices/?location={location['id']}", headers=headers)
                old_data['devices'].extend(devices_response.json())
            
            return old_data
            
        except requests.RequestException as e:
            self.log(f"Error fetching data from API: {e}")
            raise
    
    def migrate_videos_django(self, old_videos):
        """Migrate video view counts using Django ORM"""
        self.log("Migrating video view counts...")
        
        migrated = 0
        updated = 0
        
        for video_data in old_videos:
            if video_data.get('views', 0) == 0:
                continue
            
            try:
                # Try to get existing video
                video, created = Video.objects.get_or_create(
                    video_id=video_data['video_id'],
                    defaults={
                        'title': video_data['title'],
                        'views': 0,
                        'img': video_data.get('img'),
                    }
                )
                
                if created:
                    # New video - set the view count
                    if not self.dry_run:
                        video.views = video_data['views']
                        video.save()
                    self.log(f"Created new video '{video.video_id}' with {video_data['views']} views")
                    migrated += 1
                else:
                    # Existing video - add view counts
                    old_views = video.views
                    new_views = old_views + video_data['views']
                    if not self.dry_run:
                        video.views = new_views
                        video.save()
                    self.log(f"Video '{video.video_id}': {old_views} + {video_data['views']} = {new_views} views")
                    updated += 1
                    
            except Exception as e:
                self.log(f"Error migrating video '{video_data['video_id']}': {e}")
        
        self.log(f"Videos: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_categories_django(self, old_categories):
        """Migrate category view counts using Django ORM"""
        self.log("Migrating category view counts...")
        
        migrated = 0
        updated = 0
        
        for category_data in old_categories:
            if category_data.get('views', 0) == 0:
                continue
            
            try:
                category, created = Category.objects.get_or_create(
                    name=category_data['name'],
                    defaults={'views': 0}
                )
                
                if created:
                    if not self.dry_run:
                        category.views = category_data['views']
                        category.save()
                    self.log(f"Created new category '{category.name}' with {category_data['views']} views")
                    migrated += 1
                else:
                    old_views = category.views
                    new_views = old_views + category_data['views']
                    if not self.dry_run:
                        category.views = new_views
                        category.save()
                    self.log(f"Category '{category.name}': {old_views} + {category_data['views']} = {new_views} views")
                    updated += 1
                    
            except Exception as e:
                self.log(f"Error migrating category '{category_data['name']}': {e}")
        
        self.log(f"Categories: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_locations_django(self, old_locations):
        """Migrate location view counts using Django ORM"""
        self.log("Migrating location view counts...")
        
        migrated = 0
        updated = 0
        
        for location_data in old_locations:
            if location_data.get('views', 0) == 0:
                continue
            
            try:
                location, created = Location.objects.get_or_create(
                    name=location_data['name'],
                    defaults={'views': 0}
                )
                
                if created:
                    if not self.dry_run:
                        location.views = location_data['views']
                        location.save()
                    self.log(f"Created new location '{location.name}' with {location_data['views']} views")
                    migrated += 1
                else:
                    old_views = location.views
                    new_views = old_views + location_data['views']
                    if not self.dry_run:
                        location.views = new_views
                        location.save()
                    self.log(f"Location '{location.name}': {old_views} + {location_data['views']} = {new_views} views")
                    updated += 1
                    
            except Exception as e:
                self.log(f"Error migrating location '{location_data['name']}': {e}")
        
        self.log(f"Locations: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_devices_django(self, old_devices):
        """Migrate device view counts using Django ORM"""
        self.log("Migrating device view counts...")
        
        migrated = 0
        updated = 0
        
        for device_data in old_devices:
            if device_data.get('views', 0) == 0:
                continue
            
            try:
                # Find or create the location first
                location_name = device_data.get('location', {}).get('name') if isinstance(device_data.get('location'), dict) else str(device_data.get('location', 'Unknown'))
                location, _ = Location.objects.get_or_create(
                    name=location_name,
                    defaults={'views': 0}
                )
                
                device, created = Device.objects.get_or_create(
                    client_id=device_data['client_id'],
                    location=location,
                    defaults={'views': 0}
                )
                
                if created:
                    if not self.dry_run:
                        device.views = device_data['views']
                        device.save()
                    self.log(f"Created new device '{device.client_id}' at '{location.name}' with {device_data['views']} views")
                    migrated += 1
                else:
                    old_views = device.views
                    new_views = old_views + device_data['views']
                    if not self.dry_run:
                        device.views = new_views
                        device.save()
                    self.log(f"Device '{device.client_id}' at '{location.name}': {old_views} + {device_data['views']} = {new_views} views")
                    updated += 1
                    
            except Exception as e:
                self.log(f"Error migrating device '{device_data.get('client_id', 'Unknown')}': {e}")
        
        self.log(f"Devices: {updated} updated, {migrated} created")
        return updated + migrated
    
    @transaction.atomic
    def run_migration_from_api(self, old_server_url):
        """Run migration by fetching data from old server API"""
        self.log(f"Starting migration from API: {old_server_url}")
        if self.dry_run:
            self.log("DRY RUN MODE - No actual changes will be made")
        
        # Get data from old server
        old_data = self.get_old_data_from_api(old_server_url)
        
        total_migrated = 0
        
        # Migrate each data type
        if old_data.get('categories'):
            total_migrated += self.migrate_categories_django(old_data['categories'])
        
        if old_data.get('videos'):
            total_migrated += self.migrate_videos_django(old_data['videos'])
        
        if old_data.get('locations'):
            total_migrated += self.migrate_locations_django(old_data['locations'])
        
        if old_data.get('devices'):
            total_migrated += self.migrate_devices_django(old_data['devices'])
        
        if self.dry_run:
            self.log("Dry run completed - transaction will be rolled back")
            transaction.set_rollback(True)
        else:
            self.log("Migration completed successfully!")
        
        self.log(f"Total items processed: {total_migrated}")
        return total_migrated

def main():
    parser = argparse.ArgumentParser(
        description='Migrate view count statistics using Django ORM',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run migration from old server API
    python django_migrate_stats.py --old-server http://old-server:8000/api --dry-run
    
    # Actually perform the migration
    python django_migrate_stats.py --old-server http://old-server:8000/api
        """
    )
    
    parser.add_argument('--old-server', required=True,
                       help='URL of the old statistics server API (e.g., http://localhost:8000/api)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually modifying the database')
    parser.add_argument('--log-file',
                       help='Save migration log to this file')
    
    args = parser.parse_args()
    
    # Run migration
    migrator = DjangoStatisticsMigrator(None, args.dry_run)
    
    try:
        total = migrator.run_migration_from_api(args.old_server)
        
        if args.log_file:
            with open(args.log_file, 'w') as f:
                f.write('\n'.join(migrator.migration_log))
            print(f"Log saved to {args.log_file}")
            
        print(f"Migration completed. Total items processed: {total}")
        
    except KeyboardInterrupt:
        print("\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
