# Daily N

**Un duel contre N, une nouvelle équipe chaque jour.** Daily N est un jeu de combat Pokémon jouable dans le navigateur. Vous recevez six Pokémon tirés pour la journée et devez vaincre les six Pokémon de N avec cette équipe. C'est un projet amateur inspiré de l'univers d'Unys, **pas la ROM de Pokémon Blanche** : les combats utilisent le simulateur Pokémon Showdown et ses règles de cinquième génération.

## Comment jouer

1. **Découvrez votre équipe** dans « Mon équipe ». Ses six Pokémon, leurs capacités et leurs objets sont fixés pour la journée. Vous pouvez choisir votre Pokémon de tête **avant** de commencer le défi officiel, mais vous ne pouvez pas remplacer les six Pokémon tirés.
2. **Affrontez N** depuis l'accueil ou l'écran « Le défi ». Son équipe comprend Mégapagos, Sorbouboul, Aéroptéryx, Zoroark, Cliticlic et un dragon légendaire. **Zekrom et Reshiram alternent d'un jour à l'autre.**
3. **Jouez tour par tour** : choisissez une attaque ou « Changer de Pokémon ». Les attaques ont un type, une puissance, une précision et des PP. Le simulateur gère les dégâts, les objets, les talents, les statuts et les effets de terrain. Quand l'un de vos Pokémon est K.O., choisissez un remplaçant encore disponible.
4. **Éliminez les six Pokémon de N** pour gagner ; si toute votre équipe tombe K.O., vous perdez. L'écran de fin affiche le résultat. En cas de victoire, N apparaît avec une réplique. Consultez ensuite « Statistiques » pour voir vos combats, victoires et séries.

Les barres de PV et les animations de Poké Balls rendent les changements lisibles. Pendant le combat, « Infos + journal » affiche à la demande la météo, les effets du terrain, l'équipe adverse et l'historique. Les vitesses **Lent / Normal / Rapide** règlent uniquement la présentation, pas les règles du combat. Zoroark peut se présenter sous l'apparence d'un autre Pokémon grâce à **Illusion** : sa véritable identité est révélée lorsque le talent prend fin.

## Le défi du jour et l'entraînement

| Mode | Fonctionnement |
| --- | --- |
| **Défi officiel** | Une seule tentative par jour et par navigateur. Une partie commencée peut être **reprise** après rechargement ; une fois son résultat enregistré, il faut attendre le défi suivant. Seul ce mode compte dans les statistiques. |
| **Entraînement** | Rejouable sans limite, avec l'équipe et l'adversaire du jour. N'affecte ni le résultat officiel ni les statistiques. |

La journée change **à minuit, heure de Paris**. L'équipe tirée et le dragon de N sont les mêmes pour tous les joueurs à une date donnée. La limitation de la tentative, la progression et les statistiques sont enregistrées **localement dans le navigateur** : il n'y a ni compte, ni classement partagé, ni protection contre la modification des données locales. Changer de navigateur ou d'adresse du site (par exemple de `localhost` à GitHub Pages) ne transfère pas ces données.

## Crédits

Projet non officiel et non affilié à Nintendo, The Pokémon Company, GAME FREAK ou Creatures. Pokémon et ses visuels appartiennent à leurs ayants droit. Les règles de combat sont fournies par `@pkmn/sim` (Pokémon Showdown) ; les sprites Pokémon distants proviennent de PokeAPI, et le sprite de N est fourni localement d'après les ressources de Pokémon Showdown.
