
// AI mockup

const CATEGORY_KEYWORDS = [
  {
    category: "waste_management",
    department: "Sanitation Department",
    keywords: [
      "garbage",
      "trash",
      "waste",
      "rubbish",
      "dumping",
    ],
  },
  {
    category: "road_and_infrastructure",
    department: "Public Works Department",
    keywords: [
      "road",
      "pothole",
      "sidewalk",
      "street",
      "bridge",
    ],
  },
  {
    category: "water_and_drainage",
    department: "Water and Drainage Department",
    keywords: [
      "water",
      "sewage",
      "drain",
      "flood",
      "leak",
    ],
  },
  {
    category: "public_lighting",
    department: "Electrical Maintenance Department",
    keywords: [
      "light",
      "lamp",
      "electricity",
      "dark street",
      "streetlight",
    ],
  },
  {
    category: "public_safety",
    department: "Public Safety Department",
    keywords: [
      "danger",
      "unsafe",
      "accident",
      "hazard",
      "emergency",
    ],
  },
];

const detectCategory = (text) => {
  const normalizedText = text.toLowerCase();

  const match = CATEGORY_KEYWORDS.find(({ keywords }) =>
    keywords.some((keyword) =>
      normalizedText.includes(keyword)
    )
  );

  return (
    match ?? {
      category: "general",
      department: "General Services Department",
    }
  );
};

const detectPriority = (text) => {
  const normalizedText = text.toLowerCase();

  const criticalWords = [
    "emergency",
    "life threatening",
    "fire",
    "collapse",
    "severe flooding",
  ];

  const highWords = [
    "dangerous",
    "unsafe",
    "accident",
    "blocked road",
    "sewage",
  ];

  if (
    criticalWords.some((word) =>
      normalizedText.includes(word)
    )
  ) {
    return "critical";
  }

  if (
    highWords.some((word) => normalizedText.includes(word))
  ) {
    return "high";
  }

  return "medium";
};

export const analyzeIssuePlaceholder = async ({
  title,
  description,
}) => {
  const completeText = `${title} ${description}`;
  const categoryResult = detectCategory(completeText);
  const priority = detectPriority(completeText);

  const shouldBecomeInitiative =
    description.length > 300 ||
    priority === "critical" ||
    priority === "high";

  return {
    category: categoryResult.category,
    priority,
    suggestedDepartment: categoryResult.department,
    summary:
      description.length > 250
        ? `${description.slice(0, 247)}...`
        : description,
    initiativeRecommendation: {
      shouldBecomeInitiative,
      reason: shouldBecomeInitiative
        ? "The issue may require coordinated resources or multiple execution activities."
        : "The issue may be manageable through an internal municipality response.",
    },
    confidenceScore: 0.65,
    modelName: "syntria-placeholder-rule-engine-v1",
    analyzedAt: new Date(),
  };
};