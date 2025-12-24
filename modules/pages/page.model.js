const mongoose = require('mongoose');
const { Schema } = mongoose;

const LocalizedString = new Schema({
  en: { type: String, default: '' },
  kn: { type: String, default: '' },
}, { _id: false });

const VersionSchema = new Schema({
  title: LocalizedString,
  content: { type: Schema.Types.Mixed },
  updatedAt: Date,
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { _id: false });

const PageSchema = new Schema({
  title: LocalizedString,
  slug: { type: String, required: true, index: true, unique: true },
  content: { en: Schema.Types.Mixed, kn: Schema.Types.Mixed },
  status: { type: String, enum: ['draft', 'review', 'published', 'archived'], default: 'draft' },
  departmentId: { type: String, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User' },
  publishedAt: Date,
  scheduledAt: Date,
  versions: [VersionSchema],
  tags: [String],
}, { timestamps: true });

// Simple versioning: on update push previous snapshot into versions
PageSchema.pre('findOneAndUpdate', async function (next) {
  try {
    const update = this.getUpdate();
    const docToUpdate = await this.model.findOne(this.getQuery()).lean();
    if (docToUpdate) {
      const version = {
        title: docToUpdate.title,
        content: docToUpdate.content,
        updatedAt: new Date(),
        updatedBy: update.updatedBy || null,
        note: update.note || null,
      };
      // push version
      await this.model.updateOne(this.getQuery(), { $push: { versions: version } });
    }
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Page', PageSchema);
