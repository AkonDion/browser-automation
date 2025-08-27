const fs = require('fs');
const path = require('path');
const logger = require('./logger');

class CertificateCleanup {
  constructor(config) {
    this.downloadPath = config.downloads?.path || path.join(require('os').homedir(), 'Downloads');
    this.retentionHours = config.cleanup?.retentionHours || 48; // Default 48 hours
    this.enableCleanup = config.cleanup?.enabled !== false; // Default enabled
    this.metadataFile = path.join(this.downloadPath, '.certificate_metadata.json');
    
    logger.info(`📁 Certificate cleanup initialized - Path: ${this.downloadPath}, Retention: ${this.retentionHours}h`);
  }

  /**
   * Record metadata when a certificate is created
   * @param {string} filename - Certificate filename
   * @param {Object} webhookData - Original webhook payload
   * @param {boolean} webhookSuccess - Whether webhook delivery succeeded
   */
  async recordCertificate(filename, webhookData, webhookSuccess = false) {
    if (!this.enableCleanup) return;

    try {
      const metadata = await this.loadMetadata();
      const now = new Date().toISOString();
      
      metadata[filename] = {
        createdAt: now,
        webhookDelivered: webhookSuccess,
        webhookDeliveredAt: webhookSuccess ? now : null,
        customer: webhookData?.customer?.lastName || 'Unknown',
        productCount: webhookData?.products?.length || 0,
        filePath: path.join(this.downloadPath, filename)
      };

      await this.saveMetadata(metadata);
      logger.info(`📝 Certificate metadata recorded: ${filename}`);
    } catch (error) {
      logger.error(`❌ Failed to record certificate metadata: ${error.message}`);
    }
  }

  /**
   * Update metadata when webhook is successfully delivered
   * @param {string} filename - Certificate filename
   */
  async recordWebhookDelivery(filename) {
    if (!this.enableCleanup) return;

    try {
      const metadata = await this.loadMetadata();
      if (metadata[filename]) {
        metadata[filename].webhookDelivered = true;
        metadata[filename].webhookDeliveredAt = new Date().toISOString();
        await this.saveMetadata(metadata);
        logger.info(`📡 Webhook delivery recorded for: ${filename}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to record webhook delivery: ${error.message}`);
    }
  }

  /**
   * Run cleanup process - delete old certificates
   */
  async runCleanup() {
    if (!this.enableCleanup) {
      logger.info('🧹 Certificate cleanup is disabled');
      return { cleaned: 0, errors: 0 };
    }

    logger.info('🧹 Starting certificate cleanup process...');
    
    const results = {
      cleaned: 0,
      errors: 0,
      totalSize: 0
    };

    try {
      const metadata = await this.loadMetadata();
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - (this.retentionHours * 60 * 60 * 1000));

      for (const [filename, data] of Object.entries(metadata)) {
        try {
          const shouldDelete = this.shouldDeleteFile(data, cutoffTime);
          
          if (shouldDelete.delete) {
            const deleted = await this.deleteFile(filename, data.filePath);
            if (deleted.success) {
              results.cleaned++;
              results.totalSize += deleted.size;
              delete metadata[filename]; // Remove from metadata
              logger.info(`🗑️ Deleted certificate: ${filename} (${shouldDelete.reason})`);
            } else {
              results.errors++;
            }
          } else {
            logger.debug(`⏳ Keeping certificate: ${filename} (${shouldDelete.reason})`);
          }
        } catch (error) {
          logger.error(`❌ Error processing ${filename}: ${error.message}`);
          results.errors++;
        }
      }

      // Clean up metadata for non-existent files
      await this.cleanupOrphanedMetadata(metadata);
      await this.saveMetadata(metadata);

      const sizeStr = this.formatBytes(results.totalSize);
      logger.info(`✅ Cleanup completed: ${results.cleaned} files deleted (${sizeStr}), ${results.errors} errors`);

    } catch (error) {
      logger.error(`❌ Cleanup process failed: ${error.message}`);
      results.errors++;
    }

    return results;
  }

  /**
   * Determine if a file should be deleted
   * @param {Object} fileData - File metadata
   * @param {Date} cutoffTime - Time before which files should be deleted
   */
  shouldDeleteFile(fileData, cutoffTime) {
    const createdAt = new Date(fileData.createdAt);
    const webhookDeliveredAt = fileData.webhookDeliveredAt ? new Date(fileData.webhookDeliveredAt) : null;

    // Strategy 1: If webhook was delivered, use delivery time + retention
    if (fileData.webhookDelivered && webhookDeliveredAt) {
      const webhookCutoff = new Date(webhookDeliveredAt.getTime() + (this.retentionHours * 60 * 60 * 1000));
      if (new Date() > webhookCutoff) {
        return { delete: true, reason: `48h after webhook delivery (${webhookDeliveredAt.toISOString()})` };
      }
    }

    // Strategy 2: If no webhook delivery, use creation time + retention
    if (createdAt < cutoffTime) {
      const hoursOld = Math.floor((new Date() - createdAt) / (1000 * 60 * 60));
      return { delete: true, reason: `${hoursOld}h old (created ${createdAt.toISOString()})` };
    }

    // Keep the file
    const age = Math.floor((new Date() - createdAt) / (1000 * 60 * 60));
    return { delete: false, reason: `only ${age}h old, keeping` };
  }

  /**
   * Delete a certificate file
   * @param {string} filename - Certificate filename
   * @param {string} filePath - Full path to file
   */
  async deleteFile(filename, filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn(`⚠️ File not found for deletion: ${filePath}`);
        return { success: true, size: 0 }; // Consider it successful if already gone
      }

      const stats = fs.statSync(filePath);
      const size = stats.size;

      fs.unlinkSync(filePath);
      logger.info(`🗑️ Deleted certificate file: ${filename} (${this.formatBytes(size)})`);
      
      return { success: true, size };
    } catch (error) {
      logger.error(`❌ Failed to delete ${filename}: ${error.message}`);
      return { success: false, size: 0 };
    }
  }

  /**
   * Remove metadata entries for files that no longer exist
   * @param {Object} metadata - Current metadata object
   */
  async cleanupOrphanedMetadata(metadata) {
    let orphaned = 0;
    for (const [filename, data] of Object.entries(metadata)) {
      if (!fs.existsSync(data.filePath)) {
        delete metadata[filename];
        orphaned++;
      }
    }
    if (orphaned > 0) {
      logger.info(`🧹 Cleaned up ${orphaned} orphaned metadata entries`);
    }
  }

  /**
   * Load metadata from disk
   */
  async loadMetadata() {
    try {
      if (fs.existsSync(this.metadataFile)) {
        const data = fs.readFileSync(this.metadataFile, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      logger.warn(`⚠️ Failed to load metadata, starting fresh: ${error.message}`);
    }
    return {};
  }

  /**
   * Save metadata to disk
   * @param {Object} metadata - Metadata object to save
   */
  async saveMetadata(metadata) {
    try {
      // Ensure download directory exists
      if (!fs.existsSync(this.downloadPath)) {
        fs.mkdirSync(this.downloadPath, { recursive: true });
      }

      fs.writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      logger.error(`❌ Failed to save metadata: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getStats() {
    try {
      const metadata = await this.loadMetadata();
      const now = new Date();
      
      const stats = {
        totalCertificates: Object.keys(metadata).length,
        webhookDelivered: 0,
        pendingDelivery: 0,
        eligibleForCleanup: 0,
        totalSize: 0
      };

      const cutoffTime = new Date(now.getTime() - (this.retentionHours * 60 * 60 * 1000));

      for (const [filename, data] of Object.entries(metadata)) {
        if (fs.existsSync(data.filePath)) {
          const fileStats = fs.statSync(data.filePath);
          stats.totalSize += fileStats.size;
        }

        if (data.webhookDelivered) {
          stats.webhookDelivered++;
        } else {
          stats.pendingDelivery++;
        }

        if (this.shouldDeleteFile(data, cutoffTime).delete) {
          stats.eligibleForCleanup++;
        }
      }

      return stats;
    } catch (error) {
      logger.error(`❌ Failed to get cleanup stats: ${error.message}`);
      return null;
    }
  }

  /**
   * Format bytes for display
   * @param {number} bytes - Number of bytes
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = CertificateCleanup; 