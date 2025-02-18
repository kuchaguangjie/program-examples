import * as anchor from '@coral-xyz/anchor';
import type { Program } from '@coral-xyz/anchor';
import { BN } from 'bn.js';
import { expect } from 'chai';
import type { SwapExample } from '../target/types/swap_example';
import { type TestValues, createValues, mintingTokens } from './utils';

describe('Swap', () => {
  const provider = anchor.AnchorProvider.env();
  const connection = provider.connection;
  anchor.setProvider(provider);

  const program = anchor.workspace.SwapExample as Program<SwapExample>;

  let values: TestValues;

  beforeEach(async () => {
    values = createValues();

    await program.methods.createAmm(values.id, values.fee).accounts({ admin: values.admin.publicKey }).rpc();

    await mintingTokens({
      connection,
      creator: values.admin,
      mintAKeypair: values.mintAKeypair,
      mintBKeypair: values.mintBKeypair,
    });

    await program.methods
      .createPool()
      .accounts({
        mintA: values.mintAKeypair.publicKey,
        mintB: values.mintBKeypair.publicKey,
      })
      .rpc();

    await program.methods
      .depositLiquidity(values.depositAmountA, values.depositAmountB)
      .accounts({
        depositor: values.admin.publicKey,
      })
      .signers([values.admin])
      .rpc({ skipPreflight: true });
  });

  it('Swap from A to B', async () => {
    const input = new BN(10 ** 6);
    await program.methods
      .swapExactTokensForTokens(true, input, new BN(100))
      .accounts({
        trader: values.admin.publicKey,
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
