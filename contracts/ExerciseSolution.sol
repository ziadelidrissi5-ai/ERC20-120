// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./td/IExerciseSolution.sol";
import "./td/IERC20Mintable.sol";
import "./td/ERC20Claimable.sol";

/// @title ExerciseSolution — ERC20 102 (ex2 → ex9)
/// @notice Coffre qui garde des ClaimableTokens pour le compte des utilisateurs.
///  - ex2 : claimTokensOnBehalf() claim pour l'appelant et garde la trace
///  - ex3 : withdrawTokens() rend les tokens à l'appelant
///  - ex6 : depositTokens() via transferFrom (l'utilisateur doit avoir fait approve)
///  - ex7 : getERC20DepositAddress() renvoie le jeton de reçu, mintable seulement par ce contrat
///  - ex8 : chaque dépôt mint des reçus 1:1 à l'utilisateur
///  - ex9 : le retrait récupère les reçus via transferFrom, les brûle et rend les ClaimableTokens
contract ExerciseSolution is IExerciseSolution {
    ERC20Claimable public immutable claimableERC20;
    IERC20Mintable public depositToken;
    address public owner;

    mapping(address => uint256) private custody;

    event Claimed(address indexed user, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    constructor(ERC20Claimable _claimableERC20) {
        claimableERC20 = _claimableERC20;
        owner = msg.sender;
    }

    /// @notice À appeler une fois après le déploiement d'ExerciseSolutionToken (ex7)
    function setDepositToken(IERC20Mintable _depositToken) external {
        require(msg.sender == owner, "Not owner");
        depositToken = _depositToken;
    }

    // ---------- ex2 ----------
    function claimTokensOnBehalf() external override {
        uint256 amount = claimableERC20.claimTokens(); // mint vers ce contrat
        custody[msg.sender] += amount;
        _mintReceipt(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    function tokensInCustody(address callerAddress) external view override returns (uint256) {
        return custody[callerAddress];
    }

    // ---------- ex3 / ex9 ----------
    function withdrawTokens(uint256 amountToWithdraw) external override returns (uint256) {
        require(custody[msg.sender] >= amountToWithdraw, "Not enough tokens in custody");
        custody[msg.sender] -= amountToWithdraw;

        if (address(depositToken) != address(0)) {
            // Récupère les reçus de l'utilisateur puis les brûle
            require(
                depositToken.transferFrom(msg.sender, address(this), amountToWithdraw),
                "Receipt transferFrom failed"
            );
            depositToken.burn(amountToWithdraw);
        }

        require(claimableERC20.transfer(msg.sender, amountToWithdraw), "Transfer failed");
        emit Withdrawn(msg.sender, amountToWithdraw);
        return amountToWithdraw;
    }

    // ---------- ex6 / ex8 ----------
    function depositTokens(uint256 amountToDeposit) external override returns (uint256) {
        require(
            claimableERC20.transferFrom(msg.sender, address(this), amountToDeposit),
            "transferFrom failed"
        );
        custody[msg.sender] += amountToDeposit;
        _mintReceipt(msg.sender, amountToDeposit);
        emit Deposited(msg.sender, amountToDeposit);
        return amountToDeposit;
    }

    // ---------- ex7 ----------
    function getERC20DepositAddress() external view override returns (address) {
        return address(depositToken);
    }

    function _mintReceipt(address to, uint256 amount) internal {
        if (address(depositToken) != address(0)) {
            depositToken.mint(to, amount);
        }
    }
}
