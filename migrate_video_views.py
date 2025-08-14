#!/usr/bin/env python3
"""
Simple Video Views Migration Script

This script specifically migrates only video view counts from the old server.
Based on the analysis, you only have video views to migrate (no categories, locations, or devices).

This is a simplified version focused on your specific use case.
"""

import sqlite3
import argparse
import sys
from datetime import datetime

def migrate_video_views(old_db_path, new_db_path, dry_run=False):
    """Migrate video view counts from old database to new database"""
    
    print(f"Video Views Migration")
    print(f"From: {old_db_path}")
    print(f"To: {new_db_path}")
    if dry_run:
        print("DRY RUN MODE - No actual changes will be made")
    print("=" * 60)
    
    # Connect to old database (read-only)
    try:
        old_conn = sqlite3.connect(f"file:{old_db_path}?mode=ro", uri=True)
        old_conn.row_factory = sqlite3.Row
        print("✓ Connected to old database")
    except sqlite3.Error as e:
        print(f"Error connecting to old database: {e}")
        return False
    
    # Connect to new database
    try:
        new_conn = sqlite3.connect(new_db_path)
        new_conn.row_factory = sqlite3.Row
        print("✓ Connected to new database")
    except sqlite3.Error as e:
        print(f"Error connecting to new database: {e}")
        return False
    
    try:
        # Get videos with view counts from old database
        print("\\nFetching videos with views from old database...")
        old_cursor = old_conn.execute("""
            SELECT video_id, title, views, category_id, img
            FROM statisticsDatabase_video 
            WHERE views > 0
            ORDER BY views DESC
        """)
        old_videos = [dict(row) for row in old_cursor.fetchall()]
        
        if not old_videos:
            print("No videos with views found in old database.")
            return True
        
        print(f"Found {len(old_videos)} videos with views to migrate:")
        for video in old_videos:
            print(f"  • '{video['video_id']}' - {video['views']} views")
        
        # Start transaction on new database
        new_conn.execute("BEGIN TRANSACTION")
        
        migrated_count = 0
        updated_count = 0
        total_views_added = 0
        
        print("\\nMigrating videos...")
        
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
                # Video exists - add views
                current_views = existing['views']
                new_views = current_views + old_views
                
                print(f"  📹 '{video_id}': {current_views} + {old_views} = {new_views} views")
                
                if not dry_run:
                    new_conn.execute(
                        "UPDATE statisticsDatabase_video SET views = ? WHERE id = ?",
                        (new_views, existing['id'])
                    )
                
                updated_count += 1
                total_views_added += old_views
                
            else:
                # Video doesn't exist - create it
                print(f"  ➕ Creating '{video_id}' with {old_views} views")
                
                if not dry_run:
                    new_conn.execute("""
                        INSERT INTO statisticsDatabase_video (video_id, title, views, img, category_id)
                        VALUES (?, ?, ?, ?, ?)
                    """, (video_id, title, old_views, video.get('img'), video.get('category_id')))
                
                migrated_count += 1
                total_views_added += old_views
        
        # Commit or rollback
        if dry_run:
            new_conn.rollback()
            print("\\n🔍 DRY RUN - No changes made to database")
        else:
            new_conn.commit()
            print("\\n✅ Migration completed successfully!")
        
        print(f"\\n📊 SUMMARY:")
        print(f"  • Videos updated: {updated_count}")
        print(f"  • Videos created: {migrated_count}")
        print(f"  • Total views added: {total_views_added}")
        
        return True
        
    except Exception as e:
        new_conn.rollback()
        print(f"\\nError during migration: {e}")
        return False
    finally:
        old_conn.close()
        new_conn.close()

def main():
    parser = argparse.ArgumentParser(
        description='Migrate video view counts from old statistics server to new one',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Preview what would be migrated
    python migrate_video_views.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3 --dry-run
    
    # Actually perform the migration
    python migrate_video_views.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3
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
        print(f"Error: Old database file '{args.old_db}' does not exist")
        sys.exit(1)
        
    if not os.path.exists(args.new_db):
        print(f"Error: New database file '{args.new_db}' does not exist")
        sys.exit(1)
    
    # Run migration
    try:
        success = migrate_video_views(args.old_db, args.new_db, args.dry_run)
        if success:
            print("\\n🎉 Migration process completed successfully!")
        else:
            print("\\n❌ Migration failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\\nMigration interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\\nUnexpected error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
