import React, { useState } from "react";
import s from "./ResultSet.module.css";

export default function ResultSetGroupListEntry({ result }) {
  const [hidden, setHidden] = useState(true);
  const resultClass = result.status === "passed" ? s.Passed : s.Failed;
  const failureMessages =
    result.failureMessages.length > 0
      ? result.failureMessages.join("\n")
      : "👍";
  return (
    <div>
      <div className={s.Breadcrumbs} onClick={e => setHidden(!hidden)}>
        {result.ancestorTitles.map(title => (
          <span key={title}>{title}</span>
        ))}
        <span className={`${resultClass} ${s.Cursor}`}>{result.title}</span>
      </div>

      <pre style={{ display: hidden ? "none" : null }}>{failureMessages}</pre>
    </div>
  );
}
