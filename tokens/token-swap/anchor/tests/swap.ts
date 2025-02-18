import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { BN } from 'bn.js';
import { expect } from 'chai';
import type { SwapExample } from '../target/types/swap_example';
import { type TestValues, createValues, mintingTokens } from './utils';

describe('Swap', () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapExample as Program<SwapExample>;
  const idPubkey = new PublicKey('sL5GdtZPEmVEtKUhSQXC6Z6oJRvihg6dyiW6ZDEndD3');
  const sysPubkey = new PublicKey('11111111111111111111111111111111');
  const tpPubkey = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
  const atpPubkey = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

  let values: TestValues;

  beforeEach(async () => {
    values = createValues();

    await program.methods
      .createAmm(values.id, values.fee)
      .accountsStrict({
        amm: values.ammKey,
        admin: values.admin.publicKey,
        payer: idPubkey,
        systemProgram: sysPubkey, // ! demo
      })
      .rpc();

    await mintingTokens({
      connection,
      creator: values.admin,
      mintAKeypair: values.mintAKeypair,
      mintBKeypair: values.mintBKeypair,
    });

    await program.methods
      .createPool()
      .accountsStrict({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        mintLiquidity: values.mintLiquidity,
        mintA: values.mintAKeypair.publicKey,
        mintB: values.mintBKeypair.publicKey,
        poolAccountA: values.poolAccountA,
        poolAccountB: values.poolAccountB,
        payer: idPubkey,
        tokenProgram: tpPubkey, // ! demo
        associatedTokenProgram: atpPubkey, // ! demo
        systemProgram: sysPubkey, // ! demo
      })
      .rpc();

    await program.methods
      .depositLiquidity(values.depositAmountA, values.depositAmountB)
      .accountsStrict({
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        depositor: values.admin.publicKey,
        mintLiquidity: values.mintLiquidity,
        mintA: values.mintAKeypair.publicKey,
        mintB: values.mintBKeypair.publicKey,
        poolAccountA: values.poolAccountA,
        poolAccountB: values.poolAccountB,
        depositorAccountLiquidity: values.liquidityAccount,
        depositorAccountA: values.holderAccountA,
        depositorAccountB: values.holderAccountB,
        payer: idPubkey,
        tokenProgram: tpPubkey, // ! demo
        associatedTokenProgram: atpPubkey, // ! demo
        systemProgram: sysPubkey, // ! demo
      })
      .signers([values.admin])
      .rpc({ skipPreflight: true });
  });

  it('Swap from A to B', async () => {
    const input = new BN(10 ** 6);
    await program.methods
      .swapExactTokensForTokens(true, input, new BN(100))
      .accountsStrict({
        amm: values.ammKey,
        pool: values.poolKey,
        poolAuthority: values.poolAuthority,
        trader: values.admin.publicKey,
        mintA: values.mintAKeypair.publicKey,
        mintB: values.mintBKeypair.publicKey,
        poolAccountA: values.poolAccountA,
        poolAccountB: values.poolAccountB,
        traderAccountA: values.holderAccountA,
        traderAccountB: values.holderAccountB,
        payer: idPubkey,
        tokenProgram: tpPubkey, // ! demo
        associatedTokenProgram: atpPubkey, // ! demo
        systemProgram: sysPubkey, // ! demo
      })
      .signers([values.admin])
      .rpc({ skipPreflight: true });

    const traderTokenAccountA = await connection.getTokenAccountBalance(values.holderAccountA);
    const traderTokenAccountB = await connection.getTokenAccountBalance(values.holderAccountB);
    expect(traderTokenAccountA.value.amount).to.equal(values.defaultSupply.sub(values.depositAmountA).sub(input).toString());
    expect(Number(traderTokenAccountB.value.amount)).to.be.greaterThan(values.defaultSupply.sub(values.depositAmountB).toNumber());
    expect(Number(traderTokenAccountB.value.amount)).to.be.lessThan(values.defaultSupply.sub(values.depositAmountB).add(input).toNumber());
  });
});
