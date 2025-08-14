#!/usr/bin/env python3
"""
Statistics Migration Script

This script migrates view count data from an old statistics server to a new one
without overwriting existing data in the new server.

Usage:
    python migrate_statistics.py --old-db /path/to/old/db.sqlite3 --new-db /path/to/new/db.sqlite3 [--dry-run]
"""

import sqlite3
import argparse
import sys
from datetime import datetime
import json

class StatisticsMigrator:
    def __init__(self, old_db_path, new_db_path, dry_run=False):
        self.old_db_path = old_db_path
        self.new_db_path = new_db_path
        self.dry_run = dry_run
        self.migration_log = []
        
    def log(self, message):
        """Log migration messages"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        log_entry = f"[{timestamp}] {message}"
        print(log_entry)
        self.migration_log.append(log_entry)
    
    def connect_db(self, db_path, read_only=False):
        """Connect to SQLite database"""
        try:
            if read_only:
                conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            else:
                conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            return conn
        except sqlite3.Error as e:
            self.log(f"Error connecting to database {db_path}: {e}")
            sys.exit(1)
    
    def get_old_data(self):
        """Extract data from old database"""
        self.log("Extracting data from old database...")
        
        old_conn = self.connect_db(self.old_db_path, read_only=True)
        
        data = {
            'videos': [],
            'categories': [],
            'locations': [],
            'devices': []
        }
        
        # Get videos with view counts
        cursor = old_conn.execute("""
            SELECT video_id, title, views, category_id, img
            FROM statisticsDatabase_video 
            WHERE views > 0
            ORDER BY views DESC
        """)
        data['videos'] = [dict(row) for row in cursor.fetchall()]
        
        # Get categories with view counts
        cursor = old_conn.execute("""
            SELECT name, views 
            FROM statisticsDatabase_category 
            WHERE views > 0
            ORDER BY views DESC
        """)
        data['categories'] = [dict(row) for row in cursor.fetchall()]
        
        # Get locations with view counts
        cursor = old_conn.execute("""
            SELECT name, views, created_at, updated_at
            FROM statisticsDatabase_location 
            WHERE views > 0
            ORDER BY views DESC
        """)
        data['locations'] = [dict(row) for row in cursor.fetchall()]
        
        # Get devices with view counts
        cursor = old_conn.execute("""
            SELECT d.client_id, d.views, d.views_today, d.created_at, d.updated_at, l.name as location_name
            FROM statisticsDatabase_device d
            JOIN statisticsDatabase_location l ON d.location_id = l.id
            WHERE d.views > 0
            ORDER BY d.views DESC
        """)
        data['devices'] = [dict(row) for row in cursor.fetchall()]
        
        old_conn.close()
        
        # Log summary
        self.log(f"Found {len(data['videos'])} videos with views")
        self.log(f"Found {len(data['categories'])} categories with views") 
        self.log(f"Found {len(data['locations'])} locations with views")
        self.log(f"Found {len(data['devices'])} devices with views")
        
        return data
    
    def migrate_videos(self, new_conn, videos):
        """Migrate video view counts"""
        self.log("Migrating video view counts...")
        
        migrated = 0
        updated = 0
        
        for video in videos:
            if video['views'] == 0:
                continue
                
            # Check if video exists in new database
            cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_video WHERE video_id = ?",
                (video['video_id'],)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Video exists - add view counts
                new_views = existing['views'] + video['views']
                self.log(f"Video '{video['video_id']}': {existing['views']} + {video['views']} = {new_views} views")
                
                if not self.dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_video SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
                updated += 1
            else:
                # Video doesn't exist - create it
                self.log(f"Creating new video '{video['video_id']}' with {video['views']} views")
                
                if not self.dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_video (video_id, title, views, img, category_id)
                        VALUES (?, ?, ?, ?, ?)
                    """, (video['video_id'], video['title'], video['views'], video.get('img'), video.get('category_id')))
                migrated += 1
        
        self.log(f"Videos: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_categories(self, new_conn, categories):
        """Migrate category view counts"""
        self.log("Migrating category view counts...")
        
        migrated = 0
        updated = 0
        
        for category in categories:
            if category['views'] == 0:
                continue
                
            # Check if category exists in new database
            cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_category WHERE name = ?",
                (category['name'],)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Category exists - add view counts
                new_views = existing['views'] + category['views']
                self.log(f"Category '{category['name']}': {existing['views']} + {category['views']} = {new_views} views")
                
                if not self.dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_category SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
                updated += 1
            else:
                # Category doesn't exist - create it
                self.log(f"Creating new category '{category['name']}' with {category['views']} views")
                
                if not self.dry_run:
                    new_conn.execute(
                        "INSERT INTO statisticsDatabase_category (name, views) VALUES (?, ?)",
                        (category['name'], category['views'])
                    )
                migrated += 1
        
        self.log(f"Categories: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_locations(self, new_conn, locations):
        """Migrate location view counts"""
        self.log("Migrating location view counts...")
        
        migrated = 0
        updated = 0
        
        for location in locations:
            if location['views'] == 0:
                continue
                
            # Check if location exists in new database
            cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_location WHERE name = ?",
                (location['name'],)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Location exists - add view counts
                new_views = existing['views'] + location['views']
                self.log(f"Location '{location['name']}': {existing['views']} + {location['views']} = {new_views} views")
                
                if not self.dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_location SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
                updated += 1
            else:
                # Location doesn't exist - create it
                self.log(f"Creating new location '{location['name']}' with {location['views']} views")
                
                if not self.dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_location (name, views, created_at, updated_at)
                        VALUES (?, ?, ?, ?)
                    """, (location['name'], location['views'], 
                         location.get('created_at', datetime.now().isoformat()),
                         location.get('updated_at', datetime.now().isoformat())))
                migrated += 1
        
        self.log(f"Locations: {updated} updated, {migrated} created")
        return updated + migrated
    
    def migrate_devices(self, new_conn, devices):
        """Migrate device view counts"""
        self.log("Migrating device view counts...")
        
        migrated = 0
        updated = 0
        
        for device in devices:
            if device['views'] == 0:
                continue
            
            # First ensure the location exists
            location_cursor = new_conn.execute(
                "SELECT id FROM statisticsDatabase_location WHERE name = ?",
                (device['location_name'],)
            )
            location_row = location_cursor.fetchone()
            
            if not location_row:
                # Create location if it doesn't exist
                if not self.dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_location (name, views, created_at, updated_at)
                        VALUES (?, 0, ?, ?)
                    """, (device['location_name'], datetime.now().isoformat(), datetime.now().isoformat()))
                    location_id = new_conn.lastrowid
                else:
                    location_id = 999999  # Placeholder for dry run
                self.log(f"Created location '{device['location_name']}' for device")
            else:
                location_id = location_row['id']
            
            # Check if device exists in new database
            cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_device WHERE client_id = ? AND location_id = ?",
                (device['client_id'], location_id)
            )
            existing = cursor.fetchone()
            
            if existing:
                # Device exists - add view counts
                new_views = existing['views'] + device['views']
                self.log(f"Device '{device['client_id']}' at '{device['location_name']}': {existing['views']} + {device['views']} = {new_views} views")
                
                if not self.dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_device SET views = ?, views_today = ? WHERE id = ?",
                        (new_views, device.get('views_today', datetime.now().isoformat()), existing['id'])
                    )
                updated += 1
            else:
                # Device doesn't exist - create it
                self.log(f"Creating new device '{device['client_id']}' at '{device['location_name']}' with {device['views']} views")
                
                if not self.dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_device (client_id, location_id, views, views_today, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (device['client_id'], location_id, device['views'],
                         device.get('views_today', datetime.now().isoformat()),
                         device.get('created_at', datetime.now().isoformat()),
                         device.get('updated_at', datetime.now().isoformat())))
                migrated += 1
        
        self.log(f"Devices: {updated} updated, {migrated} created")
        return updated + migrated
    
    def run_migration(self):
        """Run the complete migration"""
        self.log(f"Starting migration from {self.old_db_path} to {self.new_db_path}")
        if self.dry_run:
            self.log("DRY RUN MODE - No actual changes will be made")
        
        # Extract data from old database
        old_data = self.get_old_data()
        
        if not any(old_data.values()):
            self.log("No data to migrate!")
            return
        
        # Connect to new database
        new_conn = self.connect_db(self.new_db_path)
        
        try:
            # Start transaction
            new_conn.execute("BEGIN TRANSACTION")
            
            total_migrated = 0
            
            # Migrate each data type
            if old_data['categories']:
                total_migrated += self.migrate_categories(new_conn, old_data['categories'])
            
            if old_data['videos']:
                total_migrated += self.migrate_videos(new_conn, old_data['videos'])
            
            if old_data['locations']:
                total_migrated += self.migrate_locations(new_conn, old_data['locations'])
            
            if old_data['devices']:
                total_migrated += self.migrate_devices(new_conn, old_data['devices'])
            
            # Commit transaction
            if not self.dry_run:
                new_conn.commit()
                self.log("Migration completed successfully!")
            else:
                new_conn.rollback()
                self.log("Dry run completed - no changes made")
                
            self.log(f"Total items processed: {total_migrated}")
            
        except Exception as e:
            new_conn.rollback()
            self.log(f"Error during migration: {e}")
            raise
        finally:
            new_conn.close()
    
    def save_log(self, log_file):
        """Save migration log to file"""
        with open(log_file, 'w') as f:
            f.write('\n'.join(self.migration_log))
        self.log(f"Log saved to {log_file}")

def main():
    parser = argparse.ArgumentParser(
        description='Migrate view count statistics between databases',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Dry run to see what would be migrated
    python migrate_statistics.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3 --dry-run
    
    # Actually perform the migration
    python migrate_statistics.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3
    
    # Run migration and save log
    python migrate_statistics.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3 --log-file migration.log
        """
    )
    
    parser.add_argument('--old-db', required=True,
                       help='Path to the old statistics database (source)')
    parser.add_argument('--new-db', required=True,
                       help='Path to the new statistics database (destination)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually modifying the new database')
    parser.add_argument('--log-file',
                       help='Save migration log to this file')
    
    args = parser.parse_args()
    
    # Validate paths
    import os
    if not os.path.exists(args.old_db):
        print(f"Error: Old database file '{args.old_db}' does not exist")
        sys.exit(1)
        
    if not os.path.exists(args.new_db):
        print(f"Error: New database file '{args.new_db}' does not exist")
        sys.exit(1)
    
    # Run migration
    migrator = StatisticsMigrator(args.old_db, args.new_db, args.dry_run)
    
    try:
        migrator.run_migration()
        
        if args.log_file:
            migrator.save_log(args.log_file)
            
    except KeyboardInterrupt:
        print("\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nMigration failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
