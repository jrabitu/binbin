import pymysql
from app.core.config import DB_HOST, DB_USER, DB_PASSWORD, DB_NAME


def get_connection():
    return pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )

def get_all_bins():
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT * FROM bins ORDER BY id ASC")
            return cursor.fetchall()
    finally:
        connection.close()
        
def get_bin_by_type(bin_type):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            sql = "SELECT * FROM bins WHERE bin_type = %s AND status IN ('active', 'near_full') LIMIT 1"
            cursor.execute(sql, (bin_type,))
            return cursor.fetchone()
    finally:
        connection.close()


def save_detection_log(
    image_path,
    source_type,
    detected_class,
    confidence,
    detected_count,
    final_bin_type,
    target_bin_id,
    detection_status,
    is_supported,
    warning_message,
    model_version
):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO detection_logs
                (
                    image_path,
                    source_type,
                    detected_class,
                    confidence,
                    detected_count,
                    final_bin_type,
                    target_bin_id,
                    detection_status,
                    is_supported,
                    warning_message,
                    model_version
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (
                image_path,
                source_type,
                detected_class,
                confidence,
                detected_count,
                final_bin_type,
                target_bin_id,
                detection_status,
                is_supported,
                warning_message,
                model_version
            ))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()

def save_sorting_action(detection_id, command_sent, action_status="pending", hardware_response=None):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO sorting_actions
                (detection_id, command_sent, action_status, hardware_response)
                VALUES (%s, %s, %s, %s)
            """
            cursor.execute(sql, (
                detection_id, 
                command_sent,
                action_status,
                hardware_response
            ))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()

def increment_bin_item_count(target_bin_id):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT item_count, capacity FROM bins WHERE id = %s",
                (target_bin_id,)
            )
            bin_row = cursor.fetchone()

            if not bin_row:
                return

            new_item_count = bin_row["item_count"] + 1
            capacity = bin_row["capacity"] or 1
            fill_percent = round((new_item_count / capacity) * 100)

            if fill_percent > 100:
                fill_percent = 100

            if fill_percent >= 100:
                bin_status = "full"
            elif fill_percent >= 80:
                bin_status = "near_full"
            else:
                bin_status = "active"

            sql = """
                UPDATE bins
                SET item_count = %s,
                    current_fill_level = %s,
                    status = %s,
                    updated_at = NOW()
                WHERE id = %s
            """
            cursor.execute(sql, (
                new_item_count,
                fill_percent,
                bin_status,
                target_bin_id
            ))
            connection.commit()
    finally:
        connection.close()

# def update_bin_fill(target_bin_id):
#     connection = get_connection()
#     try:
#         with connection.cursor() as cursor:
#             cursor.execute("SELECT item_count, capacity FROM bins WHERE id = %s", (target_bin_id,))
#             bin_row = cursor.fetchone()

#             if not bin_row:
#                 return

#             new_item_count = bin_row["item_count"] + 1
#             capacity = bin_row["capacity"]

#             fill_percent = round((new_item_count / capacity) * 100)
#             if fill_percent > 100:
#                 fill_percent = 100

#             update_sql = """
#                 UPDATE bins
#                 SET item_count = %s,
#                     current_fill_level = %s
#                 WHERE id = %s
#             """
#             cursor.execute(update_sql, (new_item_count, fill_percent, target_bin_id))
#             connection.commit()
#     finally:
#         connection.close()


def save_feedback_log(detection_id, was_correct, corrected_bin_type=None):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO feedback_logs
                (detection_id, was_correct, corrected_bin_type)
                VALUES (%s, %s, %s)
            """
            cursor.execute(sql, (detection_id, was_correct, corrected_bin_type))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()


def save_system_event(event_type, event_message, related_detection_id=None):
    connection = get_connection()
    try:
        with connection.cursor() as cursor:
            sql = """
                INSERT INTO system_events
                (event_type, event_message, related_detection_id)
                VALUES (%s, %s, %s)
            """
            cursor.execute(sql, (event_type, event_message, related_detection_id))
            connection.commit()
            return cursor.lastrowid
    finally:
        connection.close()