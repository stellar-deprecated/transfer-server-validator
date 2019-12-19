import React from "react";

export default function loading({ active }) {
  if (!active) return null;
  return <div>Loading...</div>;
}
