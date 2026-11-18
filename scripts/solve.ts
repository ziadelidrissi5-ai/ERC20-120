import { ethers, network } from "hardhat";

const TD_ADDRESSES: Record<string, { td: string; claimable: string; evaluator: string }> = {
  "11155111": {
    td: "0xeaD7680f5Bdb0aAa450399E8F49d4Efb9040Da08",
    claimable: "0xD829b447AbABDb689C1F6DC81CCe3d29b37c5992",
    evaluator: "0x822aF04084720Ade89E34e316c169435bBA9C886",
  },
  "421614": {
    td: "0xC0E2957F3d92CC2d19Eb75a86B51663D56448Ebb",
    claimable: "0x5ADeBf74a71360Be295534274041ceeD6A39977a",
    evaluator: "0xD05c425C843c327c90D2Db98Aba9B715BAA51736",
  },
};

async function deployTeacherContracts() {
  const [, teacher] = await ethers.getSigners();
  const supply = BigInt("0x108b2a2c28029094000000");
  const td = await ethers.deployContract("ERC20_102", ["ERC20-102", "ERC20-102", supply], teacher);
  await td.waitForDeployment();
  const claimable = await ethers.deployContract("ERC20Claimable", ["ClaimableToken", "CLTK", supply], teacher);
  await claimable.waitForDeployment();
  const evaluator = await ethers.deployContract("Evaluator", [td.target, claimable.target], teacher);
  await evaluator.waitForDeployment();
  await (await td.setTeacher(evaluator.target, true)).wait();
  return { td: String(td.target), claimable: String(claimable.target), evaluator: String(evaluator.target) };
}

export async function solve(log = console.log) {
  const [me] = await ethers.getSigners();
  const { chainId } = await ethers.provider.getNetwork();
  const addrs =
    TD_ADDRESSES[chainId.toString()] ??
    (network.name === "hardhat" || network.name === "localhost" ? await deployTeacherContracts() : undefined);
  if (!addrs) throw new Error(`Pas d'adresses TD connues pour chainId ${chainId}`);

  log(`Réseau : ${network.name} (chainId ${chainId})`);
  log(`Compte : ${me.address}`);
  log(`Solde ETH : ${ethers.formatEther(await ethers.provider.getBalance(me.address))}`);

  const td = await ethers.getContractAt("ERC20_102", addrs.td);
  const claimable = await ethers.getContractAt("ERC20Claimable", addrs.claimable);

  // L'Evaluator de Sepolia est l'ancienne version ("Exercice") avec un fallback() :
  // on détecte la version via les sélecteurs du bytecode.
  const code = await ethers.provider.getCode(addrs.evaluator);
  if (code === "0x") throw new Error(`Aucun contrat à l'adresse Evaluator ${addrs.evaluator}`);
  const fr = code.includes(ethers.id("exerciceProgression(address,uint256)").slice(2, 10));
  const E = fr ? "Exercice" : "Exercise";
  log(`Version de l'Evaluator : ${fr ? "ancienne (Exercice)" : "nouvelle (Exercise)"}`);
  const evaluator: any = new ethers.Contract(
    addrs.evaluator,
    [
      `function ${fr ? "exerciceProgression" : "exerciseProgression"}(address,uint256) view returns (bool)`,
      `function submit${E}(address)`,
      "function ex1_claimedPoints()",
      "function ex2_claimedFromContract()",
      "function ex3_withdrawFromContract()",
      `function ex4_approved${E}Solution()`,
      `function ex5_revoked${E}Solution()`,
      "function ex6_depositTokens()",
      "function ex7_createERC20()",
      "function ex8_depositAndMint()",
      "function ex9_withdrawAndBurn()",
    ],
    me
  );

  const done = (n: number): Promise<boolean> =>
    evaluator[fr ? "exerciceProgression" : "exerciseProgression"](me.address, n);
  const step = async (n: number, label: string, fn: () => Promise<any>) => {
    if (n >= 0 && (await done(n))) {
      log(`✔ ex${n} déjà validé — ${label}`);
      return;
    }
    const tx = await fn();
    await tx.wait();
    log(`✔ ${label}  (tx ${tx.hash})`);
  };

  if ((await claimable.balanceOf(me.address)) === 0n) {
    await step(-1, "Claim manuel de ClaimableTokens", () => claimable.claimTokens());
  }
  await step(1, "ex1_claimedPoints", () => evaluator.ex1_claimedPoints());

  let solutionAddr = process.env.SOLUTION_ADDRESS;
  if (!solutionAddr) {
    const solution = await ethers.deployContract("ExerciseSolution", [addrs.claimable]);
    await solution.waitForDeployment();
    solutionAddr = String(solution.target);
    log(`ExerciseSolution déployé : ${solutionAddr}`);
    const token = await ethers.deployContract("ExerciseSolutionToken", ["ExerciseSolutionToken", "ESTK"]);
    await token.waitForDeployment();
    log(`ExerciseSolutionToken déployé : ${token.target}`);
    await (await token.setMinter(solutionAddr, true)).wait();
    await (await solution.setDepositToken(token.target)).wait();
    log("✔ ExerciseSolution est minter et connaît son token de dépôt");
    const tx = await evaluator[`submit${E}`](solutionAddr);
    await tx.wait();
    log(`✔ submit${E}  (tx ${tx.hash})`);
  } else {
    log(`Réutilisation de ExerciseSolution : ${solutionAddr}`);
  }

  await step(2, "ex2_claimedFromContract", () => evaluator.ex2_claimedFromContract());
  await step(3, "ex3_withdrawFromContract", () => evaluator.ex3_withdrawFromContract());
  await step(4, "approve(ExerciseSolution)", () => claimable.approve(solutionAddr!, ethers.parseEther("1")));
  await step(4, `ex4_approved${E}Solution`, () => evaluator[`ex4_approved${E}Solution`]());
  await step(5, "approve(ExerciseSolution, 0) — revoke", () => claimable.approve(solutionAddr!, 0));
  await step(5, `ex5_revoked${E}Solution`, () => evaluator[`ex5_revoked${E}Solution`]());

  if ((await claimable.balanceOf(addrs.evaluator)) < 200n) {
    await step(-1, "Recharge de l'Evaluator en ClaimableTokens", async () => {
      await (await claimable.claimTokens()).wait();
      return claimable.transfer(addrs.evaluator, await claimable.distributedAmount());
    });
  }
  await step(6, "ex6_depositTokens", () => evaluator.ex6_depositTokens());
  await step(7, "ex7_createERC20", () => evaluator.ex7_createERC20());
  await step(8, "ex8_depositAndMint", () => evaluator.ex8_depositAndMint());
  await step(9, "ex9_withdrawAndBurn", () => evaluator.ex9_withdrawAndBurn());

  const progress: string[] = [];
  for (let i = 0; i <= 9; i++) progress.push(`ex${i}:${(await done(i)) ? "✔" : "✘"}`);
  const points = await td.balanceOf(me.address);
  log(`\nProgression : ${progress.join("  ")}`);
  log(`Points TD-ERC20-102 : ${ethers.formatUnits(points, 18)}`);
  return { points, solutionAddr };
}

if (require.main === module) {
  solve().catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
}
