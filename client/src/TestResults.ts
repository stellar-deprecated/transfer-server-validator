export enum TestStatus {
  SUCCESS = "Success",
  FAILURE = "Failure",
  PENDING = "Pending",
  SKIPPED = "Skipped",
  RUNNING = "Running",
}

export interface TestResult {
  name: string;
  status: TestStatus;
}
export interface TestResultSet {
  name: string;
  results: TestResult[];
  status: TestStatus;
  numFailedTests: number;
  numPassedTests: number;
}

export function makeTestResultSet(name: string): TestResultSet {
  let status = TestStatus.PENDING;
  if (name.includes(".optional")) {
    status = TestStatus.SKIPPED;
  }
  return {
    name: name,
    results: [],
    status: status,
    numFailedTests: 0,
    numPassedTests: 0,
  };
}
