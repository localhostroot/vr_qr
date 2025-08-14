#!/usr/bin/env python3
"""
Database Comparison and Migration Analysis Tool

This script dumps both old and new statistics databases, compares them,
and provides a detailed analysis of what data needs to be migrated.

This is the safest approach as it lets you see exactly what's different
before making any changes.
"""

import sqlite3
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path

class DatabaseAnalyzer:
    def __init__(self):
        self.old_data = {}
        self.new_data = {}
        self.migration_plan = {}
    
    def dump_database(self, db_path, name):
        """Dump all statistics data from a database"""
        print(f"\n📊 Analyzing {name} database: {db_path}")
        print("-" * 60)
        
        try:
            conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
            conn.row_factory = sqlite3.Row
            
            data = {
                'database_path': db_path,
                'analysis_date': datetime.now().isoformat(),
                'videos': {},
                'categories': {},
                'locations': {},
                'devices': {},
                'summary': {}
            }
            
            # Videos
            cursor = conn.execute("""
                SELECT video_id, title, views, category_id, img
                FROM statisticsDatabase_video 
                ORDER BY video_id
            """)
            videos = cursor.fetchall()
            
            for video in videos:
                data['videos'][video['video_id']] = {
                    'title': video['title'],
                    'views': video['views'],
                    'category_id': video['category_id'],
                    'img': video['img']
                }
            
            videos_with_views = sum(1 for v in data['videos'].values() if v['views'] > 0)
            total_video_views = sum(v['views'] for v in data['videos'].values())
            
            print(f"📹 Videos: {len(data['videos'])} total, {videos_with_views} with views ({total_video_views} total views)")
            
            # Categories
            cursor = conn.execute("""
                SELECT id, name, views 
                FROM statisticsDatabase_category 
                ORDER BY name
            """)
            categories = cursor.fetchall()
            
            for category in categories:
                data['categories'][category['name']] = {
                    'id': category['id'],
                    'views': category['views']
                }
            
            categories_with_views = sum(1 for c in data['categories'].values() if c['views'] > 0)
            total_category_views = sum(c['views'] for c in data['categories'].values())
            
            print(f"📂 Categories: {len(data['categories'])} total, {categories_with_views} with views ({total_category_views} total views)")
            
            # Locations
            cursor = conn.execute("""
                SELECT id, name, views, created_at, updated_at
                FROM statisticsDatabase_location 
                ORDER BY name
            """)
            locations = cursor.fetchall()
            
            for location in locations:
                data['locations'][location['name']] = {
                    'id': location['id'],
                    'views': location['views'],
                    'created_at': location['created_at'],
                    'updated_at': location['updated_at']
                }
            
            locations_with_views = sum(1 for l in data['locations'].values() if l['views'] > 0)
            total_location_views = sum(l['views'] for l in data['locations'].values())
            
            print(f"📍 Locations: {len(data['locations'])} total, {locations_with_views} with views ({total_location_views} total views)")
            
            # Devices
            cursor = conn.execute("""
                SELECT d.id, d.client_id, d.views, d.views_today, d.created_at, d.updated_at, 
                       l.name as location_name
                FROM statisticsDatabase_device d
                LEFT JOIN statisticsDatabase_location l ON d.location_id = l.id
                ORDER BY d.client_id, l.name
            """)
            devices = cursor.fetchall()
            
            for device in devices:
                key = f"{device['client_id']}@{device['location_name'] or 'unknown'}"
                data['devices'][key] = {
                    'id': device['id'],
                    'client_id': device['client_id'],
                    'location_name': device['location_name'],
                    'views': device['views'],
                    'views_today': device['views_today'],
                    'created_at': device['created_at'],
                    'updated_at': device['updated_at']
                }
            
            devices_with_views = sum(1 for d in data['devices'].values() if d['views'] > 0)
            total_device_views = sum(d['views'] for d in data['devices'].values())
            
            print(f"📱 Devices: {len(data['devices'])} total, {devices_with_views} with views ({total_device_views} total views)")
            
            # Summary
            data['summary'] = {
                'total_videos': len(data['videos']),
                'videos_with_views': videos_with_views,
                'total_video_views': total_video_views,
                'total_categories': len(data['categories']),
                'categories_with_views': categories_with_views,
                'total_category_views': total_category_views,
                'total_locations': len(data['locations']),
                'locations_with_views': locations_with_views,
                'total_location_views': total_location_views,
                'total_devices': len(data['devices']),
                'devices_with_views': devices_with_views,
                'total_device_views': total_device_views
            }
            
            conn.close()
            return data
            
        except sqlite3.Error as e:
            print(f"❌ Error reading database: {e}")
            sys.exit(1)
    
    def compare_databases(self, old_data, new_data):
        """Compare old and new databases to determine migration plan"""
        print(f"\n🔍 COMPARING DATABASES")
        print("=" * 60)
        
        migration_plan = {
            'videos': {
                'to_create': {},
                'to_update': {},
                'no_change': {}
            },
            'categories': {
                'to_create': {},
                'to_update': {},
                'no_change': {}
            },
            'locations': {
                'to_create': {},
                'to_update': {},
                'no_change': {}
            },
            'devices': {
                'to_create': {},
                'to_update': {},
                'no_change': {}
            },
            'summary': {}
        }
        
        # Compare videos
        print(f"\n📹 VIDEO COMPARISON:")
        for video_id, old_video in old_data['videos'].items():
            if old_video['views'] == 0:
                continue  # Skip videos with no views
                
            if video_id in new_data['videos']:
                new_video = new_data['videos'][video_id]
                if old_video['views'] > 0:  # Only migrate if old has views
                    migration_plan['videos']['to_update'][video_id] = {
                        'old_views': old_video['views'],
                        'current_views': new_video['views'],
                        'new_views': new_video['views'] + old_video['views'],
                        'title': old_video['title']
                    }
                    print(f"  📹 UPDATE '{video_id}': {new_video['views']} + {old_video['views']} = {new_video['views'] + old_video['views']} views")
                else:
                    migration_plan['videos']['no_change'][video_id] = old_video
            else:
                if old_video['views'] > 0:  # Only create if old has views
                    migration_plan['videos']['to_create'][video_id] = old_video
                    print(f"  ➕ CREATE '{video_id}': {old_video['views']} views")
        
        # Compare categories
        print(f"\n📂 CATEGORY COMPARISON:")
        for cat_name, old_cat in old_data['categories'].items():
            if old_cat['views'] == 0:
                continue
                
            if cat_name in new_data['categories']:
                new_cat = new_data['categories'][cat_name]
                if old_cat['views'] > 0:
                    migration_plan['categories']['to_update'][cat_name] = {
                        'old_views': old_cat['views'],
                        'current_views': new_cat['views'],
                        'new_views': new_cat['views'] + old_cat['views']
                    }
                    print(f"  📂 UPDATE '{cat_name}': {new_cat['views']} + {old_cat['views']} = {new_cat['views'] + old_cat['views']} views")
                else:
                    migration_plan['categories']['no_change'][cat_name] = old_cat
            else:
                if old_cat['views'] > 0:
                    migration_plan['categories']['to_create'][cat_name] = old_cat
                    print(f"  ➕ CREATE '{cat_name}': {old_cat['views']} views")
        
        # Compare locations
        print(f"\n📍 LOCATION COMPARISON:")
        for loc_name, old_loc in old_data['locations'].items():
            if old_loc['views'] == 0:
                continue
                
            if loc_name in new_data['locations']:
                new_loc = new_data['locations'][loc_name]
                if old_loc['views'] > 0:
                    migration_plan['locations']['to_update'][loc_name] = {
                        'old_views': old_loc['views'],
                        'current_views': new_loc['views'],
                        'new_views': new_loc['views'] + old_loc['views']
                    }
                    print(f"  📍 UPDATE '{loc_name}': {new_loc['views']} + {old_loc['views']} = {new_loc['views'] + old_loc['views']} views")
                else:
                    migration_plan['locations']['no_change'][loc_name] = old_loc
            else:
                if old_loc['views'] > 0:
                    migration_plan['locations']['to_create'][loc_name] = old_loc
                    print(f"  ➕ CREATE '{loc_name}': {old_loc['views']} views")
        
        # Compare devices
        print(f"\n📱 DEVICE COMPARISON:")
        for device_key, old_device in old_data['devices'].items():
            if old_device['views'] == 0:
                continue
                
            if device_key in new_data['devices']:
                new_device = new_data['devices'][device_key]
                if old_device['views'] > 0:
                    migration_plan['devices']['to_update'][device_key] = {
                        'old_views': old_device['views'],
                        'current_views': new_device['views'],
                        'new_views': new_device['views'] + old_device['views'],
                        'client_id': old_device['client_id'],
                        'location_name': old_device['location_name']
                    }
                    print(f"  📱 UPDATE '{device_key}': {new_device['views']} + {old_device['views']} = {new_device['views'] + old_device['views']} views")
                else:
                    migration_plan['devices']['no_change'][device_key] = old_device
            else:
                if old_device['views'] > 0:
                    migration_plan['devices']['to_create'][device_key] = old_device
                    print(f"  ➕ CREATE '{device_key}': {old_device['views']} views")
        
        # Migration summary
        video_updates = len(migration_plan['videos']['to_update'])
        video_creates = len(migration_plan['videos']['to_create'])
        cat_updates = len(migration_plan['categories']['to_update'])
        cat_creates = len(migration_plan['categories']['to_create'])
        loc_updates = len(migration_plan['locations']['to_update'])
        loc_creates = len(migration_plan['locations']['to_create'])
        dev_updates = len(migration_plan['devices']['to_update'])
        dev_creates = len(migration_plan['devices']['to_create'])
        
        total_views_to_add = 0
        for video in migration_plan['videos']['to_update'].values():
            total_views_to_add += video['old_views']
        for video in migration_plan['videos']['to_create'].values():
            total_views_to_add += video['views']
        for cat in migration_plan['categories']['to_update'].values():
            total_views_to_add += cat['old_views']
        for cat in migration_plan['categories']['to_create'].values():
            total_views_to_add += cat['views']
        
        migration_plan['summary'] = {
            'video_updates': video_updates,
            'video_creates': video_creates,
            'category_updates': cat_updates,
            'category_creates': cat_creates,
            'location_updates': loc_updates,
            'location_creates': loc_creates,
            'device_updates': dev_updates,
            'device_creates': dev_creates,
            'total_operations': video_updates + video_creates + cat_updates + cat_creates + loc_updates + loc_creates + dev_updates + dev_creates,
            'total_views_to_add': total_views_to_add
        }
        
        print(f"\n📋 MIGRATION SUMMARY:")
        print(f"  Videos: {video_updates} updates, {video_creates} creates")
        print(f"  Categories: {cat_updates} updates, {cat_creates} creates")
        print(f"  Locations: {loc_updates} updates, {loc_creates} creates")
        print(f"  Devices: {dev_updates} updates, {dev_creates} creates")
        print(f"  Total operations: {migration_plan['summary']['total_operations']}")
        print(f"  Total views to add: {total_views_to_add}")
        
        if migration_plan['summary']['total_operations'] == 0:
            print(f"  🎉 No migration needed! Databases are in sync.")
        
        return migration_plan
    
    def export_analysis(self, old_data, new_data, migration_plan, export_file):
        """Export complete analysis to JSON file"""
        analysis = {
            'analysis_date': datetime.now().isoformat(),
            'old_database': old_data,
            'new_database': new_data,
            'migration_plan': migration_plan
        }
        
        with open(export_file, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False)
        
        print(f"\n💾 Complete analysis exported to: {export_file}")
        return analysis

def main():
    parser = argparse.ArgumentParser(
        description='Compare statistics databases and analyze migration requirements',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Compare databases and show what needs to be migrated
    python compare_databases.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3
    
    # Compare and export detailed analysis to JSON
    python compare_databases.py --old-db ../statisticsDataServer/db.sqlite3 --new-db /path/to/new/db.sqlite3 --export analysis.json
        """
    )
    
    parser.add_argument('--old-db', required=True,
                       help='Path to the old statistics database')
    parser.add_argument('--new-db', required=True,
                       help='Path to the new statistics database')
    parser.add_argument('--export',
                       help='Export detailed analysis to JSON file')
    
    args = parser.parse_args()
    
    # Validate paths
    import os
    if not os.path.exists(args.old_db):
        print(f"❌ Error: Old database file '{args.old_db}' does not exist")
        sys.exit(1)
        
    if not os.path.exists(args.new_db):
        print(f"❌ Error: New database file '{args.new_db}' does not exist")
        sys.exit(1)
    
    try:
        analyzer = DatabaseAnalyzer()
        
        # Dump both databases
        print("🔍 ANALYZING DATABASES")
        print("=" * 60)
        
        old_data = analyzer.dump_database(args.old_db, "OLD")
        new_data = analyzer.dump_database(args.new_db, "NEW")
        
        # Compare and create migration plan
        migration_plan = analyzer.compare_databases(old_data, new_data)
        
        # Export analysis if requested
        if args.export:
            analyzer.export_analysis(old_data, new_data, migration_plan, args.export)
        
        print(f"\n✅ Analysis complete!")
        
        if migration_plan['summary']['total_operations'] > 0:
            print(f"\n💡 Next steps:")
            print(f"  1. Review the migration plan above")
            print(f"  2. Use migrate_video_views.py with --dry-run to test")
            print(f"  3. Run actual migration when satisfied")
        
    except KeyboardInterrupt:
        print("\nAnalysis interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nAnalysis failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
