import { pgTable, text, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bankAccountsTable = pgTable("bank_accounts", {
  id: text("id").primaryKey(), // 'bank-usd', 'bank-gbp', 'bank-eur', 'bank-inr'
  currency: varchar("currency", { length: 3 }).notNull().unique(),
  bankName: text("bank_name").notNull(),
  bankAddress: text("bank_address").notNull(),
  beneficiary: text("beneficiary").notNull().default("HEALWEAL LLC"),
  accountType: text("account_type").default("CHECKING"),
  accountNumberEncrypted: text("account_number_encrypted"),
  accountNumberMasked: text("account_number_masked").notNull().default("—"),
  routingAba: text("routing_aba"),
  swift: text("swift"),
  sortCode: text("sort_code"),
  ibanEncrypted: text("iban_encrypted"),
  ibanMasked: text("iban_masked"),
  bic: text("bic"),
  isActive: boolean("is_active").notNull().default(true),
  isVerified: boolean("is_verified").notNull().default(true),
  isAvailable: boolean("is_available").notNull().default(true),
  notes: text("notes"),
  unavailableMessage: text("unavailable_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBankAccountSchema = createInsertSchema(bankAccountsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankAccount = typeof bankAccountsTable.$inferSelect;
