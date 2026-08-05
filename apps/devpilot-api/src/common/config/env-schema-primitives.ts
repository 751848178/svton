import { z } from "zod";

export const booleanString = z
  .string()
  .transform((value) => value === "true" || value === "1")
  .or(z.boolean());

export const positiveInt = (min = 1) =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "number" ? value : Number(value)))
    .refine((number) => Number.isFinite(number) && number >= min, {
      message: `must be a finite number >= ${min}`,
    });
