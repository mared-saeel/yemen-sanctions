CREATE TABLE `audit_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int,
	`companyId` int,
	`userName` varchar(255),
	`companyName` varchar(255),
	`action` enum('search','view','export','login','logout','admin') NOT NULL,
	`query` varchar(1024),
	`filters` json,
	`resultsCount` int,
	`topMatchScore` float,
	`exportFormat` varchar(20),
	`ipAddress` varchar(64),
	`userAgent` varchar(512),
	`duration` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`nameAr` varchar(255),
	`licenseNumber` varchar(100),
	`country` varchar(100),
	`contactEmail` varchar(320),
	`contactPhone` varchar(50),
	`isActive` boolean NOT NULL DEFAULT true,
	`maxUsers` int NOT NULL DEFAULT 10,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sanctions_records` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nameEn` varchar(512) NOT NULL,
	`nameAr` varchar(512),
	`entityType` enum('individual','organisation','vessel','unspecified') NOT NULL DEFAULT 'unspecified',
	`listingDate` varchar(30),
	`listingReason` varchar(255),
	`issuingBody` varchar(100),
	`legalBasis` varchar(255),
	`actionTaken` varchar(512),
	`nationality` varchar(255),
	`dateOfBirth` varchar(50),
	`placeOfBirth` varchar(512),
	`alternativeNames` json,
	`notes` text,
	`referenceNumber` varchar(100),
	`rawNotes` text,
	`searchIndex` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sanctions_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `search_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`companyId` int,
	`sessionToken` varchar(128) NOT NULL,
	`totalSearches` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `search_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `search_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `companyId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `isActive` boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE INDEX `userId_idx` ON `audit_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `companyId_idx` ON `audit_logs` (`companyId`);--> statement-breakpoint
CREATE INDEX `action_idx` ON `audit_logs` (`action`);--> statement-breakpoint
CREATE INDEX `createdAt_idx` ON `audit_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `nameEn_idx` ON `sanctions_records` (`nameEn`);--> statement-breakpoint
CREATE INDEX `nameAr_idx` ON `sanctions_records` (`nameAr`);--> statement-breakpoint
CREATE INDEX `entityType_idx` ON `sanctions_records` (`entityType`);--> statement-breakpoint
CREATE INDEX `issuingBody_idx` ON `sanctions_records` (`issuingBody`);--> statement-breakpoint
CREATE INDEX `listingReason_idx` ON `sanctions_records` (`listingReason`);--> statement-breakpoint
CREATE INDEX `nationality_idx` ON `sanctions_records` (`nationality`);--> statement-breakpoint
CREATE INDEX `listingDate_idx` ON `sanctions_records` (`listingDate`);