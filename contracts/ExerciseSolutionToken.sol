// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./td/IERC20Mintable.sol";

/// @title ExerciseSolutionToken — jeton "reçu de dépôt" (ex7 → ex9)
/// @notice Mintable uniquement par les minters (ExerciseSolution).
///         Les minters peuvent aussi faire transferFrom sans allowance préalable,
///         ce qui permet à ExerciseSolution de récupérer les reçus avant de les brûler
///         (l'Evaluator ne fait jamais d'approve sur ce token).
contract ExerciseSolutionToken is ERC20, IERC20Mintable {
    address public owner;
    mapping(address => bool) private minters;

    event MinterSet(address indexed minter, bool isMinter);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyMinter() {
        require(minters[msg.sender], "Not minter");
        _;
    }

    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        owner = msg.sender;
    }

    function setMinter(address minterAddress, bool _isMinter) external override onlyOwner {
        minters[minterAddress] = _isMinter;
        emit MinterSet(minterAddress, _isMinter);
    }

    /// @notice Transfert de propriété (utile si on veut que ExerciseSolution gère tout)
    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function isMinter(address minterAddress) external view override returns (bool) {
        return minters[minterAddress];
    }

    function mint(address toAddress, uint256 amount) external override onlyMinter {
        _mint(toAddress, amount);
    }

    /// @notice Brûle ses propres jetons
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /// @dev Un minter (ExerciseSolution) peut déplacer les reçus sans allowance.
    function transferFrom(address sender, address recipient, uint256 amount)
        public
        override(ERC20, IERC20)
        returns (bool)
    {
        if (minters[msg.sender]) {
            _transfer(sender, recipient, amount);
            return true;
        }
        return super.transferFrom(sender, recipient, amount);
    }
}
