# ERC20-102 — Solution complète

Solution du workshop [ERC20-102](https://github.com/Elli610/Blockchain-101/tree/main/workshops/solidity/erc20-102).
Testée de bout en bout en local contre l'`Evaluator` d'origine : **ex0 → ex9 validés, 20/20 points**.

## Contenu

| Fichier | Rôle |
|---|---|
| `contracts/ExerciseSolution.sol` | Coffre qui garde des ClaimableTokens (ex2 → ex9) |
| `contracts/ExerciseSolutionToken.sol` | Jeton de reçu mintable, minter = `ExerciseSolution` (ex7 → ex9) |
| `contracts/td/*` | Contrats du prof, recopiés tels quels (Evaluator, tokens, interfaces) |
| `scripts/solve.ts` | Fait tout le TD en un seul passage : claim, déploiement, submit, ex1 → ex9 |
| `test/solve.test.ts` | Rejoue le TD complet sur le réseau local Hardhat |

## Lancer

```bash
npm install
cp .env.example .env    # PRIVATE_KEY + SEPOLIA_RPC_URL (Alchemy/Infura)
npx hardhat test        # vérification locale : 20 points
npm run solve:sepolia   # vrai rendu sur Sepolia (il faut un peu de Sepolia ETH)
```

Arbitrum Sepolia : `npm run solve:arb` (renseigner `ARB_SEPOLIA_RPC_URL`).
Holesky n'est plus en service, d'où Sepolia par défaut.

Le script saute les exercices déjà validés. Si une exécution s'arrête en cours de route après le
`submitExercise`, relance-la avec `SOLUTION_ADDRESS=0x... npm run solve:sepolia` pour réutiliser le contrat déjà soumis.

## Comment ça marche, exercice par exercice

- **ex1** : l'EOA appelle `claimTokens()` sur ClaimableToken, puis `ex1_claimedPoints()`.
- **submit** : `submitExercise(ExerciseSolution)` → 1 point.
- **ex2** : `claimTokensOnBehalf()` appelle `claimTokens()` depuis le contrat (les tokens sont mintés au contrat) et crédite `custody[msg.sender]`.
- **ex3** : `withdrawTokens(n)` décrémente la custody et fait `transfer` vers l'appelant.
- **ex4 / ex5** : `approve(ExerciseSolution, x)` puis `approve(ExerciseSolution, 0)` depuis l'EOA.
- **ex6** : `depositTokens(n)` fait `transferFrom(msg.sender, this, n)` (l'Evaluator a fait `increaseAllowance` avant) et crédite la custody.
- **ex7** : `getERC20DepositAddress()` renvoie `ExerciseSolutionToken` ; seul `ExerciseSolution` est minter, l'Evaluator ne peut pas minter.
- **ex8** : chaque dépôt (et chaque claim) mint des reçus 1:1 à l'utilisateur.
- **ex9** : au retrait, `ExerciseSolution` récupère les reçus via `transferFrom`, les brûle, puis rend les ClaimableTokens.

### Point subtil (ex9)

L'Evaluator ne fait jamais `approve` sur le jeton de reçu, donc un `transferFrom` classique échouerait.
`ExerciseSolutionToken` autorise donc ses minters à faire `transferFrom` sans allowance. Le seul minter étant
`ExerciseSolution`, cela ne donne aucun pouvoir à quelqu'un d'autre.

Les reçus sont aussi mintés lors de `claimTokensOnBehalf()`, pour que la même instance puisse enchaîner
ex2/ex3 puis ex6 → ex9 sans incohérence entre custody et reçus.

## Rappel « Setting up »

Les points de setup (repo Git partagé, clé API, Hardhat installé) sont attribués à la main par le prof :
pousse ce dossier sur un repo GitHub et partage-le.

## Rendu — Ethereum Sepolia

| | Adresse |
|---|---|
| Étudiant (points) | `0x0a692071836471A5DE4d071A09488b258f3D33Bc` |
| ExerciseSolution | `0x4637d48BE50b76EAA13F02f032E4665dD0994F19` |
| ExerciseSolutionToken | `0x298a0B842896fFb730C02F78AaBD6c159A44F098` |
| Tx submitExercice | `0x65fc66658b169489de8dc719be082f816f9937873e680cf8f7b39091649844f1` |

Résultat : ex0 → ex9 validés, **20 points TD-ERC20-102**.

Note : l'Evaluator déployé sur Sepolia (`0x822aF040…`) est l'ancienne version du TD (fonctions `submitExercice`,
`exerciceProgression`, `ex4_approvedExerciceSolution`…) avec un `fallback()`. `scripts/solve.ts` détecte la version
via les sélecteurs du bytecode et appelle les bons noms.
