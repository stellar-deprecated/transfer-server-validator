import React from "react";

const style = {
  color: "red",
  margin: 16
};
export default function ErrorMessage({ message }) {
  if (!message) return null;
  return <div style={style}>{message}</div>;
}
