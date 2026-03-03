CREATE TABLE `import_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`userName` varchar(255),
	`fileName` varchar(512) NOT NULL,
	`importMode` enum('append','replace') NOT NULL DEFAULT 'append',
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`totalRows` int,
	`importedRows` int,
	`skippedRows` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `import_logs_id` PRIMARY KEY(`id`)
);
