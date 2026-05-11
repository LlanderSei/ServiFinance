type PasswordPolicyChecklistProps = {
  password: string;
  confirmPassword?: string;
  email?: string | null;
  fullName?: string | null;
  tenantDomainSlug?: string | null;
  businessName?: string | null;
  className?: string;
};

const commonPasswords = [
  "password",
  "password1",
  "password12",
  "password123",
  "password1234",
  "admin",
  "admin123",
  "administrator",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "welcome123",
  "changeme",
  "change-me",
  "servifinance",
  "superadmin",
  "12345678",
  "123456789",
  "1234567890",
  "11111111",
  "iloveyou"
];

const sequences = [
  "abcdefghijklmnopqrstuvwxyz",
  "zyxwvutsrqponmlkjihgfedcba",
  "0123456789",
  "9876543210",
  "qwertyuiop",
  "poiuytrewq",
  "asdfghjkl",
  "lkjhgfdsa",
  "zxcvbnm",
  "mnbvcxz"
];

export function PasswordPolicyChecklist({
  password,
  confirmPassword,
  email,
  fullName,
  tenantDomainSlug,
  businessName,
  className
}: PasswordPolicyChecklistProps) {
  if (!password && !confirmPassword) {
    return null;
  }

  const normalizedPassword = normalizeToken(password);
  const personalTokens = buildPersonalTokens([email, fullName, tenantDomainSlug, businessName]);
  const strictChecks = [
    {
      label: "At least 12 characters",
      passed: password.length >= 12
    },
    {
      label: "Not a common password",
      passed: Boolean(normalizedPassword) &&
        !commonPasswords.some((common) => normalizedPassword.includes(normalizeToken(common)))
    },
    {
      label: "No long repeated characters",
      passed: !hasRepeatedRun(password)
    },
    {
      label: "No obvious sequences like 1234 or qwerty",
      passed: !hasSequentialRun(normalizedPassword)
    },
    {
      label: "Not similar to email, name, tenant, or business",
      passed: !personalTokens.some((token) => normalizedPassword.includes(token))
    }
  ];
  const optionalChecks = [
    {
      label: "Add uppercase letters for better strength",
      passed: /[A-Z]/.test(password)
    },
    {
      label: "Add numbers for better strength",
      passed: /\d/.test(password)
    },
    {
      label: "Add symbols for better strength",
      passed: /[^A-Za-z0-9]/.test(password)
    }
  ];
  const confirmCheck = confirmPassword !== undefined && confirmPassword.length > 0
    ? {
        label: "Confirmation matches",
        passed: password === confirmPassword
      }
    : null;
  const strictPassed = strictChecks.filter((check) => check.passed).length + (confirmCheck?.passed ? 1 : 0);
  const strictTotal = strictChecks.length + (confirmCheck ? 1 : 0);
  const optionalPassed = optionalChecks.filter((check) => check.passed).length;
  const strength = getStrengthLabel(strictPassed, strictTotal, optionalPassed);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-slate-800">Password strength</strong>
        <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] ${strength.className}`}>
          {strength.label}
        </span>
      </div>
      <div className="mt-3 grid gap-1.5">
        {strictChecks.map((check) => (
          <PasswordCheckRow key={check.label} label={check.label} passed={check.passed} />
        ))}
        {confirmCheck ? (
          <PasswordCheckRow label={confirmCheck.label} passed={confirmCheck.passed} />
        ) : null}
      </div>
      <div className="mt-3 border-t border-slate-200 pt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Optional strength boosters</p>
        <div className="mt-2 grid gap-1.5">
          {optionalChecks.map((check) => (
            <PasswordCheckRow key={check.label} label={check.label} passed={check.passed} optional />
          ))}
        </div>
      </div>
    </div>
  );
}

function PasswordCheckRow({
  label,
  passed,
  optional = false
}: {
  label: string;
  passed: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.62rem] font-bold ${passed ? "bg-emerald-100 text-emerald-700" : optional ? "bg-slate-200 text-slate-500" : "bg-rose-100 text-rose-700"}`}>
        {passed ? "ok" : "!"}
      </span>
      <span className={passed ? "text-slate-700" : optional ? "text-slate-500" : "text-rose-700"}>
        {label}
      </span>
    </div>
  );
}

function getStrengthLabel(strictPassed: number, strictTotal: number, optionalPassed: number) {
  if (strictPassed < strictTotal) {
    return {
      label: "Needs work",
      className: "bg-rose-100 text-rose-700"
    };
  }

  if (optionalPassed >= 2) {
    return {
      label: "Strong",
      className: "bg-emerald-100 text-emerald-700"
    };
  }

  return {
    label: "Valid",
    className: "bg-blue-100 text-blue-700"
  };
}

function hasRepeatedRun(password: string) {
  let runLength = 1;
  for (let index = 1; index < password.length; index += 1) {
    if (password[index].toLowerCase() === password[index - 1].toLowerCase()) {
      runLength += 1;
      if (runLength >= 4) {
        return true;
      }
    } else {
      runLength = 1;
    }
  }

  return false;
}

function hasSequentialRun(normalizedPassword: string) {
  return sequences.some((sequence) => {
    for (let index = 0; index <= sequence.length - 4; index += 1) {
      if (normalizedPassword.includes(sequence.slice(index, index + 4))) {
        return true;
      }
    }

    return false;
  });
}

function buildPersonalTokens(values: Array<string | null | undefined>) {
  return values.flatMap((value) => {
    if (!value?.trim()) {
      return [];
    }

    return value
      .trim()
      .split(/[^A-Za-z0-9]+/)
      .map(normalizeToken)
      .filter((token) => token.length >= 4);
  });
}

function normalizeToken(value: string) {
  return value
    .split("")
    .filter((character) => /[A-Za-z0-9]/.test(character))
    .join("")
    .toLowerCase();
}
