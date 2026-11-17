export function validateExtractedTopics(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 200)
    throw new Error("Expected 1–200 extracted topics.");
  return value.map((t) => {
    if (
      !t ||
      typeof t.title !== "string" ||
      !t.title.trim() ||
      t.title.length > 200 ||
      !["Easy", "Medium", "Hard"].includes(t.difficulty) ||
      typeof t.estimatedHours !== "number" ||
      !Number.isFinite(t.estimatedHours) ||
      t.estimatedHours < 1 / 6 ||
      t.estimatedHours > 24 ||
      (t.subject !== undefined &&
        (typeof t.subject !== "string" || t.subject.length > 160))
    )
      throw new Error(
        "The AI returned an invalid topic. Try a clearer syllabus.",
      );
    return {
      title: t.title.trim(),
      difficulty: t.difficulty,
      estimatedHours: t.estimatedHours,
      ...(t.subject ? { subject: t.subject } : {}),
    };
  });
}
