import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import FormField from "../../../components/ui/FormField.jsx";
import Input from "../../../components/ui/Input.jsx";
import Toggle from "../../../components/ui/Toggle.jsx";
import { useAuth } from "../hooks/useAuth.js";

const initialState = {
  email: "",
  username: "",
  password: "",
  repeatPassword: "",
  dateOfBirth: "",
  showAdultContent: false,
};

function isAdult(dateString) {
  if (!dateString) return false;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return false;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 18;
}

function validate(state) {
  const errors = {};
  const normalizedUsername = state.username.trim();

  if (!state.email.trim()) errors.email = "Email is required.";
  if (!normalizedUsername) {
    errors.username = "Username is required.";
  } else if (normalizedUsername.length < 4) {
    errors.username = "Username must be at least 4 characters.";
  }

  if (!state.password) {
    errors.password = "Password is required.";
  } else if (state.password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  }

  if (!state.repeatPassword) {
    errors.repeatPassword = "Please repeat your password.";
  } else if (state.repeatPassword !== state.password) {
    errors.repeatPassword = "Passwords do not match.";
  }

  if (!state.dateOfBirth) {
    errors.dateOfBirth = "Date of birth is required.";
  }

  return errors;
}

function RegisterForm() {
  const navigate = useNavigate();
  const { signUp, signInWithOAuth } = useAuth();

  const [formState, setFormState] = useState(initialState);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isAdultUser = isAdult(formState.dateOfBirth);

  const onChangeField = (fieldName) => (event) => {
    const nextValue = event.target.value;
    setFormState((current) => {
      const nextState = {
        ...current,
        [fieldName]: nextValue,
      };

      if (fieldName === "dateOfBirth" && !isAdult(nextValue)) {
        nextState.showAdultContent = false;
      }

      return nextState;
    });
  };

  const onChangeAdultContent = (next) => {
    setFormState((current) => ({ ...current, showAdultContent: next }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors = validate(formState);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    setIsSubmitting(true);
    const emailRedirectTo = `${window.location.origin}/verify-email`;
    const { data, error } = await signUp({
      email: formState.email.trim(),
      password: formState.password,
      emailRedirectTo,
      metadata: {
        username: formState.username.trim(),
        date_of_birth: formState.dateOfBirth,
        show_adult_content: formState.showAdultContent,
      },
    });
    setIsSubmitting(false);

    if (error) {
      const normalized = error.message?.toLowerCase() ?? "";
      if (
        normalized.includes("already registered") ||
        normalized.includes("already exists") ||
        normalized.includes("user already") ||
        normalized.includes("email address is invalid")
      ) {
        setSubmitError("This email is already in use.");
      } else {
        setSubmitError(error.message ?? "Failed to create account.");
      }
      return;
    }

    if (data?.user) {
      navigate(
        `/verify-email?email=${encodeURIComponent(formState.email.trim())}`,
      );
    }
  };

  const onOAuth = (provider) => async () => {
    setSubmitError(null);
    const { error } = await signInWithOAuth({
      provider,
      redirectTo: `${window.location.origin}/`,
    });
    if (error) setSubmitError(error.message ?? `Failed to sign in with ${provider}.`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-[980px] rounded-[18px] border-[0.833px] border-[#6f6fdc] bg-gradient-to-b from-[rgba(12,16,66,0.2)] to-[rgba(20,27,95,0.2)] px-[clamp(12px,2.2vw,26px)] pb-[12px] pt-[10px] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)]"
    >
      <h1 className="mb-[12px] text-center text-[24px] font-extrabold leading-none text-[#8383e7] sm:text-[30px]">
        Register
      </h1>

      <div className="grid grid-cols-1 gap-x-[clamp(12px,2vw,24px)] gap-y-[10px] md:grid-cols-2">
        <FormField label="email" htmlFor="email" error={errors.email} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="example@watchpapa.tv"
            value={formState.email}
            onChange={onChangeField("email")}
            aria-invalid={Boolean(errors.email)}
          />
        </FormField>

        <FormField label="username" htmlFor="username" error={errors.username} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="username"
            value={formState.username}
            onChange={onChangeField("username")}
            aria-invalid={Boolean(errors.username)}
          />
        </FormField>

        <FormField label="password" htmlFor="password" error={errors.password} labelClassName="text-[18px] sm:text-[22px]">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="************"
            value={formState.password}
            onChange={onChangeField("password")}
            aria-invalid={Boolean(errors.password)}
          />
        </FormField>

        <FormField
          label="date of birth"
          htmlFor="dateOfBirth"
          error={errors.dateOfBirth}
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <Input
            id="dateOfBirth"
            name="dateOfBirth"
            type="date"
            value={formState.dateOfBirth}
            onChange={onChangeField("dateOfBirth")}
            aria-invalid={Boolean(errors.dateOfBirth)}
          />
        </FormField>

        <FormField
          label="repeat password"
          htmlFor="repeatPassword"
          error={errors.repeatPassword}
          labelClassName="text-[18px] sm:text-[22px]"
        >
          <Input
            id="repeatPassword"
            name="repeatPassword"
            type="password"
            autoComplete="new-password"
            placeholder="************"
            value={formState.repeatPassword}
            onChange={onChangeField("repeatPassword")}
            aria-invalid={Boolean(errors.repeatPassword)}
          />
        </FormField>

        {isAdultUser ? (
          <FormField
            label="show adult content"
            htmlFor="showAdultContent"
            labelClassName="text-[18px] sm:text-[22px]"
          >
            <Toggle value={formState.showAdultContent} onChange={onChangeAdultContent} />
          </FormField>
        ) : null}
      </div>

      {submitError ? (
        <p className="mt-[10px] text-center text-[12px] font-semibold text-pink-300">
          {submitError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-[12px] inline-flex w-full items-center justify-center rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[16px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6f6fdc] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111320] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Creating account..." : "Create account"}
      </button>

      <div className="mt-[10px] flex items-center gap-[8px] text-[14px] font-extrabold text-[#8383e7]">
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
        <span>or</span>
        <span className="h-px flex-1 bg-[#6f6fdc]/50" />
      </div>

      <div className="mt-[10px] flex flex-col items-center gap-[8px]">
        <button
          type="button"
          onClick={onOAuth("google")}
          className="inline-flex w-full max-w-[360px] items-center justify-center gap-[10px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7]"
        >
          Continue with Google
        </button>
        <button
          type="button"
          onClick={onOAuth("github")}
          className="inline-flex w-full max-w-[360px] items-center justify-center gap-[10px] rounded-[14px] border-[0.833px] border-[#8383e7] bg-gradient-to-b from-[rgba(12,16,66,0.5)] to-[rgba(20,27,95,0.5)] px-4 py-2 text-[14px] font-extrabold text-[#8383e7] shadow-[0_3.333px_3.333px_rgba(0,0,0,0.25)] transition hover:text-[#a0a0f7]"
        >
          Continue with GitHub
        </button>
      </div>

      <p className="mt-[12px] text-center text-[13px] font-extrabold text-[#8383e7]">
        Already a member?{" "}
        <Link to="/login" className="underline transition hover:text-[#a0a0f7]">
          Login
        </Link>
      </p>
    </form>
  );
}

export default RegisterForm;
