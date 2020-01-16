import React, { useState } from "react";
import s from "./DomainInput.module.css";

export default function({ onValidateClick }) {
  const [domain, setDomain] = useState(
    "https://stellar-anchor-server.herokuapp.com"
  );
  return (
    <div className={s.InputContainer}>
      <input
        type="text"
        className={s.Field}
        value={domain}
        onChange={e => setDomain(e.target.value)}
      ></input>
      <input
        className={s.Button}
        type="button"
        onClick={e => onValidateClick(domain)}
        value="Validate"
      />
    </div>
  );
}
