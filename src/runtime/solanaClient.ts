import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction, type TransactionSignature } from "@solana/web3.js";

export type SolanaBalances = {
  sol: string;
  usdc: string;
};

export type UsdcAccountBalance = {
  ata: PublicKey;
  baseUnits: bigint;
  display: string;
  exists: boolean;
};

export type FundAgentParams = {
  amount: string;
  connection: Connection;
  payer: PublicKey;
  recipient: PublicKey;
  signAndSendTransaction: (transaction: Transaction, minContextSlot: number) => Promise<TransactionSignature>;
  usdcMint: PublicKey;
};

const SOL_DECIMALS = 9;
const USDC_DECIMALS = 6;

function trimAmount(value: number, maxDecimals: number) {
  return value.toLocaleString(undefined, {
    maximumFractionDigits: maxDecimals,
    minimumFractionDigits: 0,
  });
}

function parseUsdcAmount(amount: string) {
  const normalized = amount.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(normalized)) {
    throw new Error("Enter a USDC amount with up to 6 decimals.");
  }

  const [whole = "0", fraction = ""] = normalized.split(".");
  return BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function publicKeyOrNull(value: string) {
  try {
    return value.trim() ? new PublicKey(value.trim()) : null;
  } catch {
    return null;
  }
}

export function generateAgentKeypair() {
  const keypair = Keypair.generate();
  return {
    address: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  };
}

export function agentKeypairFromSecret(value: string | number[]) {
  const parsed = Array.isArray(value) ? value : JSON.parse(value.trim());
  if (!Array.isArray(parsed)) throw new Error("Keypair must be a JSON array of 64 secret-key bytes.");
  const bytes = Uint8Array.from(parsed.map((item) => Number(item)));
  if (bytes.length !== 64 || bytes.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) {
    throw new Error("Keypair must contain exactly 64 byte values from 0 to 255.");
  }
  const keypair = Keypair.fromSecretKey(bytes);
  return {
    address: keypair.publicKey.toBase58(),
    secretKey: Array.from(keypair.secretKey),
  };
}

export async function getSolanaBalances(connection: Connection, owner: PublicKey, usdcMint: PublicKey): Promise<SolanaBalances> {
  const [lamports, tokenBalance] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    getUsdcBalance(connection, owner, usdcMint),
  ]);

  return {
    sol: trimAmount(lamports / 10 ** SOL_DECIMALS, 4),
    usdc: tokenBalance,
  };
}

async function getUsdcBalance(connection: Connection, owner: PublicKey, usdcMint: PublicKey) {
  return (await getUsdcAccountBalance(connection, owner, usdcMint, true)).display;
}

export async function getUsdcAccountBalance(
  connection: Connection,
  owner: PublicKey,
  usdcMint: PublicKey,
  allowOwnerOffCurve = false,
): Promise<UsdcAccountBalance> {
  const ata = getAssociatedTokenAddressSync(usdcMint, owner, allowOwnerOffCurve, TOKEN_PROGRAM_ID);
  const account = await connection.getAccountInfo(ata, "confirmed");
  if (!account) return { ata, baseUnits: 0n, display: "0", exists: false };

  const balance = await connection.getTokenAccountBalance(ata, "confirmed");
  return {
    ata,
    baseUnits: BigInt(balance.value.amount),
    display: trimAmount(Number(balance.value.amount) / 10 ** USDC_DECIMALS, 6),
    exists: true,
  };
}

export async function fundAgentWallet({
  amount,
  connection,
  payer,
  recipient,
  signAndSendTransaction,
  usdcMint,
}: FundAgentParams): Promise<TransactionSignature> {
  const amountBaseUnits = parseUsdcAmount(amount);
  if (amountBaseUnits <= 0n) throw new Error("Fund amount must be greater than 0 USDC.");

  const payerLamports = await connection.getBalance(payer, "confirmed");
  if (payerLamports <= 0) {
    throw new Error("Connected wallet has no SOL for transaction fees. Add SOL before funding the agent wallet.");
  }

  const sourceAta = getAssociatedTokenAddressSync(usdcMint, payer, false, TOKEN_PROGRAM_ID);
  const recipientAta = getAssociatedTokenAddressSync(usdcMint, recipient, true, TOKEN_PROGRAM_ID);
  const payerUsdc = await getUsdcAccountBalance(connection, payer, usdcMint, false);
  if (!payerUsdc.exists) {
    throw new Error("Connected wallet does not have a USDC token account. Add USDC before funding the agent wallet.");
  }
  if (payerUsdc.baseUnits < amountBaseUnits) {
    throw new Error(`Connected wallet has ${payerUsdc.display} USDC, but ${amount} USDC was requested.`);
  }
  const recipientAtaInfo = await connection.getAccountInfo(recipientAta, "confirmed");
  const latest = await connection.getLatestBlockhashAndContext("confirmed");

  const transaction = new Transaction({
    feePayer: payer,
    recentBlockhash: latest.value.blockhash,
  });

  if (!recipientAtaInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(payer, recipientAta, recipient, usdcMint, TOKEN_PROGRAM_ID));
  }

  transaction.add(
    createTransferCheckedInstruction(
      sourceAta,
      usdcMint,
      recipientAta,
      payer,
      amountBaseUnits,
      USDC_DECIMALS,
      [],
      TOKEN_PROGRAM_ID,
    ),
  );

  const signature = await signAndSendTransaction(transaction, latest.context.slot);
  if (!signature) throw new Error("Wallet did not return a transaction signature.");

  return signature;
}
