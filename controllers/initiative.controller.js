const { Initiative } = require("../models");

const createInitiative = async (req, res, next) => {
  try {
    const initiative = await Initiative.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Initiative created successfully.",
      data: initiative,
    });
  } catch (error) {
    return next(error);
  }
};

const getInitiatives = async (req, res, next) => {
  try {
    const initiatives = await Initiative.find()
      .populate("createdBy", "firstName lastName email")
      .populate("municipality", "name type")
      .populate("leadOrganization", "name type")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: initiatives.length,
      data: initiatives,
    });
  } catch (error) {
    return next(error);
  }
};

const getInitiativeById = async (req, res, next) => {
  try {
    const initiative = await Initiative.findById(
      req.params.initiativeId
    )
      .populate("createdBy", "firstName lastName email")
      .populate("municipality", "name type")
      .populate("leadOrganization", "name type");

    if (!initiative) {
      return res.status(404).json({
        success: false,
        message: "Initiative not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: initiative,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createInitiative,
  getInitiatives,
  getInitiativeById,
};