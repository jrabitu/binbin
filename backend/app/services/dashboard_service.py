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
                WHERE detection_status IN ('success', 'detected')
            """)
            successful_sorts = cursor.fetchone()["total"]

            cursor.execute("SELECT COUNT(*) AS total FROM system_events")
            total_events = cursor.fetchone()["total"]

            cursor.execute("""
                SELECT ROUND(AVG(COALESCE(final_confidence, confidence)) * 100, 1) AS avg_conf
                FROM detection_logs
                WHERE detection_status IN ('success', 'detected', 'confirmation_required')
            """)
            avg_row = cursor.fetchone()
            avg_confidence = float(avg_row["avg_conf"]) if avg_row and avg_row["avg_conf"] else 0

            cursor.execute("""
                SELECT detection_status, COUNT(*) AS cnt
                FROM detection_logs
                GROUP BY detection_status
            """)
            status_breakdown = {
                r["detection_status"]: r["cnt"]
                for r in cursor.fetchall()
            }

            cursor.execute("""
                SELECT COALESCE(final_class, detected_class) AS class_name, COUNT(*) AS cnt
                FROM detection_logs
                WHERE detection_status IN ('success', 'detected', 'confirmation_required')
                GROUP BY class_name
                ORDER BY cnt DESC
                LIMIT 6
            """)
            class_breakdown = {
                r["class_name"]: r["cnt"]
                for r in cursor.fetchall()
            }

            return {
                "total_detections": total_detections,
                "today_detections": today_detections,
                "successful_sorts": successful_sorts,
                "total_events": total_events,
                "avg_confidence": avg_confidence,
                "status_breakdown": status_breakdown,
                "class_breakdown": class_breakdown,
            }
    finally:
        connection.close()


def get_trashcan_overview():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    t.id,
                    t.trashcan_name,
                    t.location,
                    t.is_real_device,
                    t.status,
                    COUNT(b.id) AS bin_count,
                    COALESCE(SUM(b.item_count), 0) AS total_items,
                    COALESCE(ROUND(AVG(b.current_fill_level), 0), 0) AS avg_fill_level,
                    MAX(b.updated_at) AS last_update
                FROM trashcans t
                LEFT JOIN bins b ON b.trashcan_id = t.id
                GROUP BY
                    t.id,
                    t.trashcan_name,
                    t.location,
                    t.is_real_device,
                    t.status
                ORDER BY t.id ASC
            """)
            return cursor.fetchall()
    finally:
        connection.close()


def get_trashcan_detail(trashcan_id: int):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    id,
                    trashcan_name,
                    location,
                    is_real_device,
                    status,
                    created_at,
                    updated_at
                FROM trashcans
                WHERE id = %s
            """, (trashcan_id,))
            trashcan = cursor.fetchone()

            if not trashcan:
                return None

            cursor.execute("""
                SELECT
                    id,
                    bin_name,
                    bin_type,
                    location,
                    capacity,
                    item_count,
                    current_fill_level,
                    status,
                    updated_at
                FROM bins
                WHERE trashcan_id = %s
                ORDER BY
                    FIELD(bin_type, 'plastic', 'paper', 'can', 'general'),
                    id ASC
            """, (trashcan_id,))
            bins = cursor.fetchall()

            cursor.execute("""
                SELECT
                    dl.id,
                    dl.image_path,
                    dl.crop_path,
                    dl.detected_class,
                    dl.confidence,
                    dl.yolo_class,
                    dl.yolo_confidence,
                    dl.classifier_class,
                    dl.classifier_confidence,
                    dl.final_class,
                    dl.final_confidence,
                    dl.agreement_type,
                    dl.detected_count,
                    dl.final_bin_type,
                    dl.detection_status,
                    dl.is_supported,
                    dl.warning_message,
                    dl.model_version,
                    dl.created_at
                FROM detection_logs dl
                JOIN bins b ON dl.target_bin_id = b.id
                WHERE b.trashcan_id = %s
                ORDER BY dl.created_at DESC
                LIMIT 12
            """, (trashcan_id,))
            logs = cursor.fetchall()

            cursor.execute("""
                SELECT
                    id,
                    event_type,
                    event_message,
                    related_detection_id,
                    created_at
                FROM system_events
                WHERE trashcan_id = %s
                   OR related_detection_id IN (
                        SELECT dl.id
                        FROM detection_logs dl
                        JOIN bins b ON dl.target_bin_id = b.id
                        WHERE b.trashcan_id = %s
                   )
                ORDER BY created_at DESC
                LIMIT 12
            """, (trashcan_id, trashcan_id))
            events = cursor.fetchall()

            return {
                "trashcan": trashcan,
                "bins": bins,
                "logs": logs,
                "events": events,
            }
    finally:
        connection.close()


def get_bin_stats():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    b.id,
                    b.trashcan_id,
                    t.trashcan_name,
                    b.bin_name,
                    b.bin_type,
                    b.location,
                    b.item_count,
                    b.status,
                    COALESCE(b.current_fill_level, 0) AS current_fill_level,
                    COALESCE(b.capacity, 100) AS capacity
                FROM bins b
                LEFT JOIN trashcans t ON b.trashcan_id = t.id
                ORDER BY b.trashcan_id ASC, b.id ASC
            """)
            return cursor.fetchall()
    finally:
        connection.close()


def get_recent_logs(limit=12):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    dl.id,
                    dl.detected_class,
                    dl.confidence,
                    dl.yolo_class,
                    dl.yolo_confidence,
                    dl.classifier_class,
                    dl.classifier_confidence,
                    dl.final_class,
                    dl.final_confidence,
                    dl.agreement_type,
                    dl.detected_count,
                    dl.final_bin_type,
                    dl.detection_status,
                    dl.model_version,
                    dl.created_at,
                    b.trashcan_id,
                    t.trashcan_name
                FROM detection_logs dl
                LEFT JOIN bins b ON dl.target_bin_id = b.id
                LEFT JOIN trashcans t ON b.trashcan_id = t.id
                ORDER BY dl.created_at DESC
                LIMIT %s
            """, (limit,))
            return cursor.fetchall()
    finally:
        connection.close()


def get_recent_events(limit=12):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("""
                SELECT
                    se.id,
                    se.trashcan_id,
                    t.trashcan_name,
                    se.event_type,
                    se.event_message,
                    se.related_detection_id,
                    se.created_at
                FROM system_events se
                LEFT JOIN trashcans t ON se.trashcan_id = t.id
                ORDER BY se.created_at DESC
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
                "total_feedback": row["total_feedback"] or 0,
            }
    finally:
        connection.close()