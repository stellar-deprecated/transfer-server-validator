export enum TestStatus {
  SUCCESS = "Success",
  FAILURE = "Failure",
  PENDING = "Pending",
  SKIPPED = "Skipped",
  RUNNING = "Running"
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
