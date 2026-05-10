CREATE DATABASE IF NOT EXISTS monbin_db;
USE monbin_db;

CREATE TABLE `bins` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `bin_name` varchar(50) NOT NULL,
  `bin_type` varchar(50) NOT NULL,
  `location` varchar(100),
  `capacity` int,
  `current_fill_level` int DEFAULT 0,
  `status` varchar(30) DEFAULT 'active',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `detection_logs` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `image_path` varchar(255),
  `detected_class` varchar(100) NOT NULL,
  `confidence` decimal(5,4) NOT NULL,
  `target_bin_id` int,
  `detection_status` varchar(50) DEFAULT 'detected',
  `warning_message` varchar(255),
  `model_version` varchar(100),
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `sorting_actions` (
  `id` int PRIMARY KEY AUTO_INCREMENT,
  `detection_id` int UNIQUE NOT NULL,
  `command_sent` varchar(100),
  `action_status` varchar(50) DEFAULT 'pending',
  `hardware_response` varchar(255),
  `action_time` datetime DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE `detection_logs`
ADD CONSTRAINT `fk_detection_logs_bin`
FOREIGN KEY (`target_bin_id`) REFERENCES `bins` (`id`);

ALTER TABLE `sorting_actions`
ADD CONSTRAINT `fk_sorting_actions_detection`
FOREIGN KEY (`detection_id`) REFERENCES `detection_logs` (`id`);