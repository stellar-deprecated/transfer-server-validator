import React from "react";
import path from "path";
import s from "./ResultSet.module.css";

export default function ResultSetGroupHeader({ section }) {
  const name = path.basename(section.name);
  const total = section.assertionResults.length;
  const passing = section.assertionResults.filter(
    result => result.status === "passed"
  ).length;
  return (
    <div className={s.ResultSetGroupHeader}>
      {section.status === "failed" ? "❌" : "✅"} {name} {passing} / {total}
    </div>
  );
}
