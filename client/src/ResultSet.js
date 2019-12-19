import React from "react";
import s from "./ResultSet.module.css";
import ResultSetGroupHeader from "./ResultSetGroupHeader";
import ResultSetGroupList from "./ResultSetGroupList";

export default function ResultSet({ results }) {
  if (!results) return null;
  const numPassedTests = results.numPassedTests;
  const numTotalTests = results.numTotalTests;
  const sections = results.testResults.map(section => {
    return (
      <div key={section.name}>
        <ResultSetGroupHeader section={section} />
        <ResultSetGroupList section={section} />
      </div>
    );
  });
  return (
    <div className={s.ResultContainer}>
      <div className={s.ResultBanner}>
        Passed {numPassedTests} / {numTotalTests} tests
      </div>
      {sections}
    </div>
  );
}
