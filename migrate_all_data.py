#!/usr/bin/env python3
"""
Complete Statistics Data Migration Script

Based on database analysis, this script migrates:
- 15 videos (14 updates + 1 create) with 550 total views
- 5 locations (all creates) with 539 total views  
- 18 devices (all creates) with 539 total views

This script performs the complete migration safely with transaction rollback on errors.
"""

import sqlite3
import argparse
import sys
from datetime import datetime

def migrate_all_statistics(old_db_path, new_db_path, dry_run=False):
    """Complete migration of all statistics data"""
    
    print(f"🚀 COMPLETE STATISTICS MIGRATION")
    print(f"From: {old_db_path}")
    print(f"To: {new_db_path}")
    if dry_run:
        print("🔍 DRY RUN MODE - No actual changes will be made")
    print("=" * 60)
    
    # Connect to databases
    try:
        old_conn = sqlite3.connect(f"file:{old_db_path}?mode=ro", uri=True)
        old_conn.row_factory = sqlite3.Row
        print("✅ Connected to old database")
    except sqlite3.Error as e:
        print(f"❌ Error connecting to old database: {e}")
        return False
    
    try:
        new_conn = sqlite3.connect(new_db_path)
        new_conn.row_factory = sqlite3.Row
        print("✅ Connected to new database")
    except sqlite3.Error as e:
        print(f"❌ Error connecting to new database: {e}")
        return False
    
    try:
        # Start transaction
        new_conn.execute("BEGIN TRANSACTION")
        print("🔄 Started database transaction")
        
        # Migration counters
        stats = {
            'videos_updated': 0,
            'videos_created': 0,
            'locations_created': 0,
            'devices_created': 0,
            'total_views_added': 0,
            'errors': []
        }
        
        # STEP 1: Migrate Videos
        print(f"\n📹 MIGRATING VIDEOS...")
        print("-" * 40)
        
        old_cursor = old_conn.execute("""
            SELECT video_id, title, views, category_id, img
            FROM statisticsDatabase_video 
            WHERE views > 0
            ORDER BY views DESC
        """)
        old_videos = [dict(row) for row in old_cursor.fetchall()]
        
        for video in old_videos:
            video_id = video['video_id']
            old_views = video['views']
            title = video['title']
            
            # Check if video exists in new database
            new_cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_video WHERE video_id = ?",
                (video_id,)
            )
            existing = new_cursor.fetchone()
            
            if existing:
                # Update existing video
                current_views = existing['views']
                new_views = current_views + old_views
                
                print(f"  📹 UPDATE '{video_id}': {current_views} + {old_views} = {new_views} views")
                
                if not dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_video SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
                
                stats['videos_updated'] += 1
                stats['total_views_added'] += old_views
                
            else:
                # Create new video
                print(f"  ➕ CREATE '{video_id}': {old_views} views")
                
                if not dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_video (video_id, title, views, img, category_id)
                        VALUES (?, ?, ?, ?, ?)
                    """, (video_id, title, old_views, video.get('img'), video.get('category_id')))
                
                stats['videos_created'] += 1
                stats['total_views_added'] += old_views
        
        # STEP 2: Migrate Locations
        print(f"\n📍 MIGRATING LOCATIONS...")
        print("-" * 40)
        
        old_cursor = old_conn.execute("""
            SELECT name, views, created_at, updated_at
            FROM statisticsDatabase_location 
            WHERE views > 0
            ORDER BY views DESC
        """)
        old_locations = [dict(row) for row in old_cursor.fetchall()]
        
        for location in old_locations:
            loc_name = location['name']
            old_views = location['views']
            
            # Check if location exists in new database
            new_cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_location WHERE name = ?",
                (loc_name,)
            )
            existing = new_cursor.fetchone()
            
            if existing:
                # Update existing location (shouldn't happen based on analysis, but safe)
                current_views = existing['views']
                new_views = current_views + old_views
                
                print(f"  📍 UPDATE '{loc_name}': {current_views} + {old_views} = {new_views} views")
                
                if not dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_location SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
            else:
                # Create new location
                print(f"  ➕ CREATE '{loc_name}': {old_views} views")
                
                if not dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_location (name, views, created_at, updated_at)
                        VALUES (?, ?, ?, ?)
                    """, (loc_name, old_views, 
                         location.get('created_at', datetime.now().isoformat()),
                         location.get('updated_at', datetime.now().isoformat())))
                
                stats['locations_created'] += 1
        
        # STEP 3: Migrate Devices
        print(f"\n📱 MIGRATING DEVICES...")
        print("-" * 40)
        
        old_cursor = old_conn.execute("""
            SELECT d.client_id, d.views, d.views_today, d.created_at, d.updated_at, l.name as location_name
            FROM statisticsDatabase_device d
            JOIN statisticsDatabase_location l ON d.location_id = l.id
            WHERE d.views > 0
            ORDER BY d.views DESC
        """)
        old_devices = [dict(row) for row in old_cursor.fetchall()]
        
        for device in old_devices:
            client_id = device['client_id']
            location_name = device['location_name']
            old_views = device['views']
            
            # First ensure the location exists in new database
            location_cursor = new_conn.execute(
                "SELECT id FROM statisticsDatabase_location WHERE name = ?",
                (location_name,)
            )
            location_row = location_cursor.fetchone()
            
            if not location_row:
                # This might happen if location wasn't created yet - create it without views
                print(f"  ➕ Creating missing location '{location_name}' for device...")
                if not dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_location (name, views, created_at, updated_at)
                        VALUES (?, 0, ?, ?)
                    """, (location_name, datetime.now().isoformat(), datetime.now().isoformat()))
                    location_id = new_conn.lastrowid
                else:
                    location_id = 999999  # Placeholder for dry run
            else:
                location_id = location_row['id']
            
            # Check if device exists
            device_cursor = new_conn.execute(
                "SELECT id, views FROM statisticsDatabase_device WHERE client_id = ? AND location_id = ?",
                (client_id, location_id)
            )
            existing_device = device_cursor.fetchone()
            
            if existing_device:
                # Update existing device (shouldn't happen based on analysis)
                current_views = existing_device['views']
                new_views = current_views + old_views
                
                print(f"  📱 UPDATE '{client_id}@{location_name}': {current_views} + {old_views} = {new_views} views")
                
                if not dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_device SET views = ?, views_today = ? WHERE id = ?",
                        (new_views, device.get('views_today', datetime.now().isoformat()), existing_device['id'])
                    )
            else:
                # Create new device
                print(f"  ➕ CREATE '{client_id}@{location_name}': {old_views} views")
                
                if not dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_device (client_id, location_id, views, views_today, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (client_id, location_id, old_views,
                         device.get('views_today', datetime.now().isoformat()),
                         device.get('created_at', datetime.now().isoformat()),
                         device.get('updated_at', datetime.now().isoformat())))
                
                stats['devices_created'] += 1
        
        # Commit or rollback transaction
        if dry_run:
            new_conn.rollback()
            print(f"\n🔍 DRY RUN COMPLETED - No changes made to database")
        else:
            new_conn.commit()
            print(f"\n✅ MIGRATION COMPLETED SUCCESSFULLY!")
        
        # Print final summary
        print(f"\n📊 MIGRATION SUMMARY:")
        print(f"  Videos updated: {stats['videos_updated']}")
        print(f"  Videos created: {stats['videos_created']}")
        print(f"  Locations created: {stats['locations_created']}")
        print(f"  Devices created: {stats['devices_created']}")
        print(f"  Total views migrated: {stats['total_views_added']}")
        print(f"  Total operations: {stats['videos_updated'] + stats['videos_created'] + stats['locations_created'] + stats['devices_created']}")
        
        if not dry_run:
            print(f"\n🎉 Migration successful! Your new database now contains all the view count data from the old server.")
        
        return True
        
    except Exception as e:
        new_conn.rollback()
        print(f"\n❌ MIGRATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return False
        
    finally:
        old_conn.close()
        new_conn.close()

def main():
    parser = argparse.ArgumentParser(
        description='Complete statistics data migration (videos, locations, devices)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Preview the complete migration
    python migrate_all_data.py --old-db old_db.sqlite3 --new-db new_db.sqlite3 --dry-run
    
    # Actually perform the migration
    python migrate_all_data.py --old-db old_db.sqlite3 --new-db new_db.sqlite3
        """
    )
    
    parser.add_argument('--old-db', required=True,
                       help='Path to the old statistics database (source)')
    parser.add_argument('--new-db', required=True,
                       help='Path to the new statistics database (destination)')
    parser.add_argument('--dry-run', action='store_true',
                       help='Preview changes without actually modifying the new database')
    
    args = parser.parse_args()
    
    # Validate paths
    import os
    if not os.path.exists(args.old_db):
        print(f"❌ Error: Old database file '{args.old_db}' does not exist")
        sys.exit(1)
        
    if not os.path.exists(args.new_db):
        print(f"❌ Error: New database file '{args.new_db}' does not exist")
        sys.exit(1)
    
    # Run migration
    try:
        success = migrate_all_statistics(args.old_db, args.new_db, args.dry_run)
        if success:
            if args.dry_run:
                print(f"\n💡 Dry run completed successfully!")
                print(f"   Run without --dry-run to perform the actual migration.")
            else:
                print(f"\n🎉 Migration completed successfully!")
        else:
            print(f"\n❌ Migration failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print(f"\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
