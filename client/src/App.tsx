import React, { useCallback, useState, useEffect } from "react";

import "./App.css";
import ErrorMessage from "./ErrorMessage";
import TestList from "./TestList";
import { TestResultSet, TestStatus, makeTestResultSet } from "./TestResults";
import runTest from "./api/runTest";
import s from "./App.module.css";

function App() {
  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);
  const [errorMessage, setErrorMessage] = useState<String | null>(null);
  // All tests available from the server
  const [availableTests, setAvailableTests] = useState<string[]>([]);
  // Current (pending) test runs
  const [testList, setTestList] = useState<TestResultSet[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [domain, setDomain] = useState(
    urlParams.get("domain") || "testanchor.stellar.org",
  );
  const [sepSelect, setSepSelect] = useState<string>(
    urlParams.get("project") || "SEP24",
  );
  const [currency, setCurrency] = useState<string>("");
  const [runOptionalTests, setRunOptionalTests] = useState<boolean>(
    Boolean(parseInt(process.env.RUN_OPTIONAL_TESTS || "0")) || false,
  );

  const fetchList = async (project: string) => {
    const res = await fetch(
      `${process.env.REACT_APP_API_HOST || ""}/list?project=${project}`,
    );
    const testNames: string[] = await res.json();
    setAvailableTests(testNames);
  };

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const currency = urlParams.get("currency");
    if (currency) {
      setCurrency(currency);
    }
    if (!["SEP24", "SEP6", "SEP31"].includes(sepSelect)) {
      setSepSelect("SEP24");
    }
  }, []);

  const resetTests = useCallback(() => {
    setTestList(
      availableTests.map((test) => {
        return makeTestResultSet(test, runOptionalTests);
      }),
    );
  }, [availableTests, runOptionalTests]);
  useEffect(resetTests, [availableTests]);

  useEffect(() => {
    resetTests();
  }, [resetTests, runOptionalTests]);

  useEffect(() => {
    const changeProject = async () => {
      await fetchList(sepSelect);
    };
    changeProject();
  }, [sepSelect]);

  const getValidDomain = useCallback(() => {
    let newDomain = domain;
    if (newDomain.indexOf("http") !== 0) {
      newDomain = `https://${newDomain}`;
    }
    newDomain =
      newDomain.substr(-1) === "/" ? newDomain.slice(0, -1) : newDomain;
    return newDomain;
  }, [domain]);

  const runTests = useCallback(
    async (_) => {
      try {
        resetTests();
        setBusy(true);
        const domainForTests = getValidDomain();
        if (currency) {
          window.history.replaceState(
            null,
            "",
            `?home_domain=${domain}&currency=${currency}`,
          );
        } else {
          window.history.replaceState(null, "", `?home_domain=${domain}`);
        }
        var nextTest: TestResultSet | undefined;
        while (
          (nextTest = testList.find(
            (result) => result.status === TestStatus.PENDING,
          )) !== undefined
        ) {
          nextTest.status = TestStatus.RUNNING;
          setTestList([...testList]);
          nextTest.results = await runTest(
            domainForTests,
            currency,
            nextTest.name,
            sepSelect,
          );
          nextTest.status = nextTest.results.every((result) => {
            return [TestStatus.SUCCESS, TestStatus.SKIPPED].includes(
              result.status,
            );
          })
            ? TestStatus.SUCCESS
            : TestStatus.FAILURE;
          setTestList([...testList]);
        }
      } catch (e) {
        setErrorMessage("Something went wrong!");
        console.error(e);
      }
      setBusy(false);
    },
    [testList, domain, sepSelect, currency, getValidDomain, resetTests],
  );

  return (
    <div className="App">
      <div className={s.DomainFieldRow}>
        <input
          className={s.DomainField}
          type="text"
          value={domain}
          placeholder="home_domain"
          onChange={(e) => setDomain(e.target.value)}
        ></input>
        <input
          className={s.CurrencyField}
          type="text"
          value={currency}
          placeholder="currency (optional)"
          onChange={(e) => setCurrency(e.target.value)}
        ></input>
        <button className={s.ValidateButton} onClick={runTests} disabled={busy}>
          {busy ? "Running..." : "Run tests"}
        </button>
      </div>
      <div className={s.FieldRow}>
        <span className={s.FieldLabel}>Select SEP: </span>
        <select
          className={s.DropdownField}
          value={sepSelect}
          onChange={(e) => setSepSelect(e.target.value)}
        >
          <option selected value="SEP24">
            SEP-24
          </option>
          <option value="SEP6">SEP-6</option>
          <option value="SEP31">SEP-31</option>
        </select>
      </div>
      <div className={s.FieldRow}>
        <span className={s.FieldLabel}>Run optional tests: </span>
        <input
          className={s.CheckboxField}
          type="checkbox"
          checked={runOptionalTests}
          onChange={(e) => setRunOptionalTests(e.target.checked)}
        ></input>
      </div>
      <ErrorMessage message={errorMessage} />
      <TestList testList={testList} />
    </div>
  );
}

export default App;
