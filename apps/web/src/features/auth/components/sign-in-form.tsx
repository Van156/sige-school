import { Button } from "@base-template/ui/components/button";
import { FieldGroup } from "@base-template/ui/components/field";
import { Input } from "@base-template/ui/components/input";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/app/auth-client";
import { clearSigeMeCache } from "@/app/sige-me";
import FormField from "@/shared/components/form/form-field";
import PasswordInput from "@/shared/components/form/password-input";

import {
  SIGN_IN_FALLBACK_MESSAGE,
  SIGN_IN_REQUIRED_MESSAGE,
  firstNameOf,
  signInErrorMessage,
  signInWithIdentifier,
} from "../lib/sige-sign-in";
import { postSignInPath, type AuthSearch } from "../lib/auth-search";
import AuthFormError from "./auth-form-error";

/**
 * AUTH-01 sign-in form (container, sige/01 §4.1): one identifier field (username or email, routed
 * by `signInWithIdentifier`) and the password. On success it lands on the dashboard route; the
 * `_org` guard then activates the institution and enforces the forced password change (AUTH-03).
 * Failures render inline above the submit button.
 */
export default function SignInForm({ search }: { search?: AuthSearch }) {
  const navigate = useNavigate({ from: "/" });
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<{ tone: "warning" | "error"; message: string } | null>(
    null,
  );

  const form = useForm({
    defaultValues: { identifier: "", password: "" },
    onSubmit: async ({ value }) => {
      if (value.identifier.trim() === "" || value.password === "") {
        setFormError({ tone: "warning", message: SIGN_IN_REQUIRED_MESSAGE });
        return;
      }
      setFormError(null);
      try {
        const result = await signInWithIdentifier(
          authClient.signIn,
          value.identifier,
          value.password,
        );
        if (result.error) {
          setFormError({ tone: "error", message: signInErrorMessage(result.error) });
          return;
        }
        clearSigeMeCache(queryClient);
        toast.success(`Bienvenido/a, ${firstNameOf(result.data?.user.name)}!`);
        void navigate({ to: postSignInPath(search) });
      } catch {
        setFormError({ tone: "error", message: SIGN_IN_FALLBACK_MESSAGE });
      }
    },
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        form.handleSubmit();
      }}
      className="flex flex-col gap-6"
    >
      {formError?.tone === "warning" ? (
        <p
          role="alert"
          className="rounded-md bg-warning/15 px-3 py-2 text-sm text-warning-foreground"
        >
          {formError.message}
        </p>
      ) : null}
      <FieldGroup className="gap-6">
        <form.Field name="identifier">
          {(field) => (
            <FormField field={field} label="Usuario o Correo">
              {(control) => (
                <Input
                  size="lg"
                  {...control}
                  autoFocus
                  placeholder="Ingrese su usuario"
                  autoComplete="username"
                />
              )}
            </FormField>
          )}
        </form.Field>
        <form.Field name="password">
          {(field) => (
            <FormField
              field={field}
              label="Contraseña"
              description={
                <Link to="/forgot-password" className="underline underline-offset-4">
                  ¿Olvidó su contraseña?
                </Link>
              }
            >
              {(control) => (
                <PasswordInput
                  {...control}
                  large
                  placeholder="Ingrese su contraseña"
                  autoComplete="current-password"
                />
              )}
            </FormField>
          )}
        </form.Field>
      </FieldGroup>
      {formError?.tone === "error" ? <AuthFormError message={formError.message} /> : null}
      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Ingresando..." : "Iniciar Sesión"}
          </Button>
        )}
      </form.Subscribe>
      <p className="text-center text-[13px] text-muted-foreground">
        ¿Problemas para acceder? Contacte al administrador
      </p>
    </form>
  );
}
