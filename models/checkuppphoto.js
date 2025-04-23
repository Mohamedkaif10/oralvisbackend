const mongoose = require("mongoose");

const checkupPhotoSchema = new mongoose.Schema({
  checkupRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "CheckupRequest",
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dentistId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  photo: { type: String, required: true },
  description: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

checkupPhotoSchema.index({ checkupRequestId: 1 }, { unique: true });

module.exports = mongoose.model("CheckupPhoto", checkupPhotoSchema);
