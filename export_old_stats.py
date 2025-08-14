#!/usr/bin/env python3
"""
Statistics Data Export and Analysis Script

This script exports data from the old statistics server and provides
an analysis of what needs to be migrated.
"""

import sqlite3
import json
import sys
from datetime import datetime

def export_statistics_data(db_path, output_file=None):
    """Export statistics data from SQLite database"""
    
    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        
        print(f"Analyzing statistics database: {db_path}")
        print("=" * 60)
        
        # Get all data
        data = {}
        
        # Videos
        cursor = conn.execute("""
            SELECT video_id, title, views, category_id, img
            FROM statisticsDatabase_video 
            ORDER BY views DESC
        """)
        videos = [dict(row) for row in cursor.fetchall()]
        data['videos'] = videos
        
        videos_with_views = [v for v in videos if v['views'] > 0]
        total_video_views = sum(v['views'] for v in videos)
        
        print(f"📹 VIDEOS:")
        print(f"   Total videos: {len(videos)}")
        print(f"   Videos with views: {len(videos_with_views)}")
        print(f"   Total video views: {total_video_views}")
        if videos_with_views:
            print(f"   Top video: '{videos_with_views[0]['video_id']}' ({videos_with_views[0]['views']} views)")
        print()
        
        # Categories 
        cursor = conn.execute("""
            SELECT name, views 
            FROM statisticsDatabase_category 
            ORDER BY views DESC
        """)
        categories = [dict(row) for row in cursor.fetchall()]
        data['categories'] = categories
        
        categories_with_views = [c for c in categories if c['views'] > 0]
        total_category_views = sum(c['views'] for c in categories)
        
        print(f"📂 CATEGORIES:")
        print(f"   Total categories: {len(categories)}")
        print(f"   Categories with views: {len(categories_with_views)}")
        print(f"   Total category views: {total_category_views}")
        if categories_with_views:
            print(f"   Top category: '{categories_with_views[0]['name']}' ({categories_with_views[0]['views']} views)")
        print()
        
        # Locations
        cursor = conn.execute("""
            SELECT name, views, created_at, updated_at
            FROM statisticsDatabase_location 
            ORDER BY views DESC
        """)
        locations = [dict(row) for row in cursor.fetchall()]
        data['locations'] = locations
        
        locations_with_views = [l for l in locations if l['views'] > 0]
        total_location_views = sum(l['views'] for l in locations)
        
        print(f"📍 LOCATIONS:")
        print(f"   Total locations: {len(locations)}")
        print(f"   Locations with views: {len(locations_with_views)}")
        print(f"   Total location views: {total_location_views}")
        if locations_with_views:
            print(f"   Top location: '{locations_with_views[0]['name']}' ({locations_with_views[0]['views']} views)")
        print()
        
        # Devices
        cursor = conn.execute("""
            SELECT d.client_id, d.views, d.views_today, d.created_at, d.updated_at, l.name as location_name
            FROM statisticsDatabase_device d
            LEFT JOIN statisticsDatabase_location l ON d.location_id = l.id
            ORDER BY d.views DESC
        """)
        devices = [dict(row) for row in cursor.fetchall()]
        data['devices'] = devices
        
        devices_with_views = [d for d in devices if d['views'] > 0]
        total_device_views = sum(d['views'] for d in devices)
        
        print(f"📱 DEVICES:")
        print(f"   Total devices: {len(devices)}")
        print(f"   Devices with views: {len(devices_with_views)}")
        print(f"   Total device views: {total_device_views}")
        if devices_with_views:
            device = devices_with_views[0]
            print(f"   Top device: '{device['client_id']}' at '{device['location_name']}' ({device['views']} views)")
        print()
        
        # Summary
        print("📊 MIGRATION SUMMARY:")
        print(f"   Items that need migration:")
        if videos_with_views:
            print(f"   • {len(videos_with_views)} videos with {total_video_views} total views")
        if categories_with_views:
            print(f"   • {len(categories_with_views)} categories with {total_category_views} total views")
        if locations_with_views:
            print(f"   • {len(locations_with_views)} locations with {total_location_views} total views")
        if devices_with_views:
            print(f"   • {len(devices_with_views)} devices with {total_device_views} total views")
        
        if not any([videos_with_views, categories_with_views, locations_with_views, devices_with_views]):
            print("   ⚠️  No data with view counts found - migration not needed!")
        
        print()
        
        # Detailed breakdown
        if videos_with_views:
            print("🔍 DETAILED VIDEO BREAKDOWN:")
            for video in videos_with_views[:10]:  # Top 10
                print(f"   • '{video['video_id']}' - {video['views']} views")
            if len(videos_with_views) > 10:
                print(f"   ... and {len(videos_with_views) - 10} more")
            print()
        
        if locations_with_views:
            print("🔍 DETAILED LOCATION BREAKDOWN:")
            for location in locations_with_views:
                print(f"   • '{location['name']}' - {location['views']} views")
            print()
        
        # Export to JSON if requested
        if output_file:
            # Add metadata
            data['export_metadata'] = {
                'export_date': datetime.now().isoformat(),
                'source_database': db_path,
                'total_videos': len(videos),
                'total_categories': len(categories),
                'total_locations': len(locations),
                'total_devices': len(devices),
                'videos_with_views': len(videos_with_views),
                'categories_with_views': len(categories_with_views),
                'locations_with_views': len(locations_with_views),
                'devices_with_views': len(devices_with_views)
            }
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            print(f"💾 Data exported to: {output_file}")
        
        conn.close()
        return data
        
    except sqlite3.Error as e:
        print(f"Error reading database: {e}")
        sys.exit(1)

def main():
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Export and analyze statistics data from old server',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Analyze the database and show summary
    python export_old_stats.py ../statisticsDataServer/db.sqlite3
    
    # Export data to JSON file for later use
    python export_old_stats.py ../statisticsDataServer/db.sqlite3 --export old_stats_data.json
        """
    )
    
    parser.add_argument('database', help='Path to the old statistics database')
    parser.add_argument('--export', help='Export data to JSON file')
    
    args = parser.parse_args()
    
    # Validate database exists
    import os
    if not os.path.exists(args.database):
        print(f"Error: Database file '{args.database}' does not exist")
        sys.exit(1)
    
    # Export and analyze
    try:
        export_statistics_data(args.database, args.export)
    except KeyboardInterrupt:
        print("\\nExport interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\\nExport failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
