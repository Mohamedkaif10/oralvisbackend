const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const CheckupRequest = require("../models/checkupprequest");
const CheckupPhoto = require("../models/checkuppphoto");

const router = express.Router();

const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token provided" });
  try {
    const decoded = jwt.verify(token, "your_jwt_secret");
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "Invalid token" });
  }
};

router.get("/dentists", async (req, res) => {
  try {
    const dentists = await User.find({ role: "dentist" }, "email _id");
    res.json(dentists);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/request", authMiddleware, async (req, res) => {
  const { dentistId } = req.body;
  const io = req.app.get("io");
  try {
    const dentist = await User.findById(dentistId);
    if (!dentist || dentist.role !== "dentist") {
      return res.status(400).json({ message: "Invalid dentist ID" });
    }
    const request = new CheckupRequest({
      userId: req.user.id,
      dentistId,
    });
    await request.save();
    io.to(dentistId).emit("checkup_request", {
      _id: request._id,
      userId: req.user.id,
      status: request.status,
      createdAt: request.createdAt,
    });
    res.status(201).json({ message: "Checkup request submitted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/requests", authMiddleware, async (req, res) => {
  try {
    const requests = await CheckupRequest.find({ dentistId: req.user.id })
      .populate("userId", "email")
      .select("userId status createdAt");
    const photos = await CheckupPhoto.find({ dentistId: req.user.id }).select(
      "checkupRequestId"
    );
    const photoMap = photos.reduce((map, photo) => {
      map[photo.checkupRequestId.toString()] = true;
      return map;
    }, {});
    const requestsWithPhotoStatus = requests.map((request) => ({
      ...request.toObject(),
      hasPhoto: !!photoMap[request._id.toString()],
    }));
    res.json(requestsWithPhotoStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/photo", authMiddleware, async (req, res) => {
  const { checkupRequestId, photo, description } = req.body;
  const io = req.app.get("io");
  try {
    const request = await CheckupRequest.findById(checkupRequestId);
    if (!request || request.dentistId.toString() !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Unauthorized or invalid request" });
    }
    const existingPhoto = await CheckupPhoto.findOne({ checkupRequestId });
    let newPhoto;
    if (existingPhoto) {
      existingPhoto.photo = photo;
      existingPhoto.description = description;
      newPhoto = await existingPhoto.save();
    } else {
      newPhoto = new CheckupPhoto({
        checkupRequestId,
        userId: request.userId,
        dentistId: req.user.id,
        photo,
        description,
      });
      await newPhoto.save();
    }

    io.to(request.userId.toString()).emit("photo_uploaded", {
      _id: newPhoto._id,
      checkupRequestId,
      userId: request.userId,
      dentistId: req.user.id,
      photo,
      description,
      createdAt: newPhoto.createdAt,
    });
    res.status(201).json({
      message: existingPhoto
        ? "Photo updated successfully"
        : "Photo uploaded successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/photos/:userId", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.userId;
    if (req.user.id !== userId && req.user.role !== "dentist") {
      return res.status(403).json({ message: "Unauthorized" });
    }
    const photos = await CheckupPhoto.find({ userId })
      .populate("checkupRequestId", "createdAt")
      .populate("dentistId", "email")
      .select("photo description createdAt");
    res.json(photos);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
