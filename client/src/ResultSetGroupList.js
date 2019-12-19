import React from "react";

import ResultSetGroupListEntry from "./ResultSetGroupListEntry";

export default function ResultSetGroupList({ section }) {
  return (
    <div>
      {section.assertionResults.map(result => (
        <ResultSetGroupListEntry key={result.fullName} result={result} />
      ))}
    </div>
  );
}
