// src/models/Report.js
import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  reportId: {
    type: String,
    unique: true,
    sparse: true // This allows multiple null values but prevents duplicate non-null values
  },
  reportType: {
    type: String,
    required: true,
    enum: ['patients_list', 'appointments_list', 'appointments_stats']
  },
  filters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  options: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  recordCount: {
    type: Number,
    default: 0
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Index for faster queries
ReportSchema.index({ reportType: 1, generatedAt: -1 });
ReportSchema.index({ createdAt: -1 });

// Pre-save middleware to generate reportId if not provided
ReportSchema.pre('save', function(next) {
  if (!this.reportId) {
    // Generate a unique report ID
    this.reportId = `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  next();
});

export default mongoose.model('Report', ReportSchema);