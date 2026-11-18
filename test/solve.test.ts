import { expect } from "chai";
import { ethers } from "hardhat";
import { solve } from "../scripts/solve";

describe("ERC20-102 — résolution complète en local", () => {
  it("valide ex0 → ex9 et obtient les 20 points", async () => {
    const { points } = await solve(() => {});
    // 5 (ex1) + 1 (submit) + 2 + 2 + 1 + 1 + 2 + 2 + 2 + 2 = 20
    expect(points).to.equal(ethers.parseUnits("20", 18));
  });

  it("le token de dépôt refuse un mint par un non-minter", async () => {
    const [, other] = await ethers.getSigners();
    const token = await ethers.deployContract("ExerciseSolutionToken", ["T", "T"]);
    await expect(token.connect(other).mint(other.address, 1)).to.be.revertedWith("Not minter");
  });
});
