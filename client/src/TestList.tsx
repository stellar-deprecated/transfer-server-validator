import React, { useState } from "react";
import s from "./Results.module.css";
import { TestResultSet, TestResult, TestStatus } from "./TestResults";

function iconFromStatus(status: TestStatus): string {
  switch (status) {
    case TestStatus.FAILURE:
      return "❌";
    case TestStatus.PENDING:
      return "⚪️";
    case TestStatus.SUCCESS:
      return "✅";
    case TestStatus.SKIPPED:
      return "⏭️";
    case TestStatus.RUNNING:
      return "🏃‍♀️";
  }
  console.log("Unknown status", status);
  return "";
}

function TestListItem({ result }: { result: TestResult }) {
  const [errorsVisible, setErrorsVisible] = useState(false);
  return (
    <div className={s.SingleTestResult}>
      <div
        className={s.SingleTestTitle}
        onClick={(e) => setErrorsVisible(!errorsVisible)}
      >
        {iconFromStatus(result.status)} {result.name}
      </div>
      <div
        className={s.ErrorMessages}
        style={{ display: errorsVisible ? "block" : "none" }}
      >
        {result.failureMessages?.map((m) => (
          <div>{m}</div>
        ))}
        <div className={s.SourceLineSet}>
          {result.releventSource?.map((sourceLine) => {
            return (
              <div
                className={`${s.SourceLine} ${
                  sourceLine.isErrorLine ? s.SourceLineActive : ""
                }`}
              >
                <span className={s.SourceLineNumber}>
                  <a
                    href={sourceLine.directLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {sourceLine.lineNumber}
                  </a>
                </span>
                <span className={s.SourceLineContent}>
                  {sourceLine.content}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function TestListRow({ testListItem }: { testListItem: TestResultSet }) {
  return (
    <div className={s.TestListRow}>
      <div className={s.TestListHeader}>
        <span className={s.TestListStatus}>
          {iconFromStatus(testListItem.status)}{" "}
        </span>
        <span className={s.TestListItemName}>
          {testListItem.name}
          <a
            href={`https://github.com/stellar/transfer-server-validator/blob/master/cases/${testListItem.name}.test.js`}
            target="_blank"
            rel="noopener noreferrer"
            className={s.OpenCaseLink}
          >
            ↗
          </a>
        </span>
      </div>
      <div className={s.TestListResults}>
        {testListItem.results.map((result) => (
          <TestListItem key={result.name} result={result} />
        ))}
      </div>
    </div>
  );
}

export default function TestList({
  testList,
}: {
  testList: TestResultSet[] | null;
}) {
  if (!testList) return <div></div>;
  return (
    <div>
      {testList.map((testListItem) => {
        return (
          <TestListRow key={testListItem.name} testListItem={testListItem} />
        );
      })}
    </div>
  );
}
