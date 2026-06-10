-- DropForeignKey
ALTER TABLE `menu` DROP FOREIGN KEY `Menu_roleId_fkey`;

-- DropForeignKey
ALTER TABLE `submenu` DROP FOREIGN KEY `Submenu_menuId_fkey`;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `lastAssignedAt` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `activity_logs_timestamp_idx` ON `activity_logs`(`timestamp`);

-- CreateIndex
CREATE INDEX `leads_stage_idx` ON `leads`(`stage`);

-- CreateIndex
CREATE INDEX `leads_country_idx` ON `leads`(`country`);

-- AddForeignKey
ALTER TABLE `menu` ADD CONSTRAINT `menu_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submenu` ADD CONSTRAINT `submenu_menuId_fkey` FOREIGN KEY (`menuId`) REFERENCES `menu`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `activity_logs_userId_idx` ON `activity_logs`(`userId`);
DROP INDEX `activity_logs_userId_fkey` ON `activity_logs`;

-- RedefineIndex
CREATE INDEX `leads_assignedTo_idx` ON `leads`(`assignedTo`);
DROP INDEX `leads_assignedTo_fkey` ON `leads`;

-- RedefineIndex
CREATE UNIQUE INDEX `rota_publicId_key` ON `rota`(`publicId`);
DROP INDEX `Rota_publicId_key` ON `rota`;

-- RedefineIndex
CREATE UNIQUE INDEX `template_publicId_key` ON `template`(`publicId`);
DROP INDEX `Template_publicId_key` ON `template`;
