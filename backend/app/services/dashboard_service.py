from app.services.db_service import get_connection


def get_summary_data():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS total FROM detection_logs")
            total_detections = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM detection_logs
                WHERE DATE(created_at) = CURDATE()
            """)
            today_detections = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT COUNT(*) AS total
                FROM detection_logs
                WHERE detection_status = 'detected'
            """)
            successful_sorts = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) AS total FROM system_events")
            total_events = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT final_bin_type, COUNT(*) AS total
                FROM detection_logs
                WHERE detection_status = 'detected'
                  AND final_bin_type IS NOT NULL
                GROUP BY final_bin_type
                ORDER BY total DESC
                LIMIT 1
            """)
            top_bin_row = cursor.fetchone()
            most_used_bin = top_bin_row["final_bin_type"] if top_bin_row else "-"

            cursor.execute("""
                SELECT ROUND(AVG(confidence) * 100, 1) AS avg_conf
                FROM detection_logs
                WHERE detection_status = 'detected'
            """)
            avg_row = cursor.fetchone()
            avg_confidence = float(avg_row["avg_conf"]) if avg_row and avg_row["avg_conf"] else 0

            cursor.execute("""
                SELECT detection_status, COUNT(*) AS cnt
                FROM detection_logs
                GROUP BY detection_status
            """)
            status_breakdown = {r["detection_status"]: r["cnt"] for r in cursor.fetchall()}

            cursor.execute("""
                SELECT detected_class, COUNT(*) AS cnt
                FROM detection_logs
                WHERE detection_status = 'detected'
                GROUP BY detected_class
                ORDER BY cnt DESC
                LIMIT 6
            """)
            class_breakdown = {r["detected_class"]: r["cnt"] for r in cursor.fetchall()}

            return {
                "total_detections": total_detections,
                "today_detections": today_detections,
                "successful_sorts": successful_sorts,
                "total_events": total_events,
                "most_used_bin": most_used_bin,
                "avg_confidence": avg_confidence,
                "status_breakdown": status_breakdown,
                "class_breakdown": class_breakdown,
            }
    finally:
        connection.close()


def get_bin_stats():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, bin_name, bin_type, location, item_count, status,
                       COALESCE(current_fill_level, 0) AS current_fill_level,
                       COALESCE(capacity, 100) AS capacity
                FROM bins
                ORDER BY id ASC
            """)
            return cursor.fetchall()
    finally:
        connection.close()


def get_recent_logs(limit=10):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, detected_class, confidence, detected_count,
                       final_bin_type, detection_status, model_version, created_at
                FROM detection_logs
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()
    finally:
        connection.close()


def get_recent_events(limit=10):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT id, event_type, event_message, related_detection_id, created_at
                FROM system_events
                ORDER BY created_at DESC
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()
    finally:
        connection.close()


def get_feedback_summary():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    SUM(CASE WHEN was_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
                    SUM(CASE WHEN was_correct = 0 THEN 1 ELSE 0 END) AS corrected_count,
                    COUNT(*) AS total_feedback
                FROM feedback_logs
            """)
            row = cursor.fetchone()

            return {
                "correct_count": row["correct_count"] or 0,
                "corrected_count": row["corrected_count"] or 0,
                "total_feedback": row["total_feedback"] or 0
            }
    finally:
        connection.close()