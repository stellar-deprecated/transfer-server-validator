import React from "react";

export default function loading({ active, message }) {
  if (!active) return null;
  return <div>{message || "Loading..."}</div>;
}
