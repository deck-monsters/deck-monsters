/* eslint-disable max-len */
const { expect } = require('../shared/test-setup');

const { xpFormula, calculateXP } = require('./experience');
const { randomContestant } = require('./bosses');

describe('./helpers/experience.js', () => {
	describe('xpFormula works', () => {
		it('calculates base 1 correctly', () => {
			expect(xpFormula(0, 1)).to.equal(1);
			expect(xpFormula(1, 1)).to.equal(1);
			expect(xpFormula(2, 1)).to.equal(0);
			expect(xpFormula(3, 1)).to.equal(0);
			expect(xpFormula(4, 1)).to.equal(0);
			expect(xpFormula(5, 1)).to.equal(0);
		});

		it('calculates base 2 correctly', () => {
			expect(xpFormula(0, 2)).to.equal(2);
			expect(xpFormula(1, 2)).to.equal(1);
			expect(xpFormula(2, 2)).to.equal(1);
			expect(xpFormula(3, 2)).to.equal(0);
			expect(xpFormula(4, 2)).to.equal(0);
			expect(xpFormula(5, 2)).to.equal(0);
		});

		it('calculates base 3 correctly', () => {
			expect(xpFormula(0, 3)).to.equal(3);
			expect(xpFormula(1, 3)).to.equal(2);
			expect(xpFormula(2, 3)).to.equal(1);
			expect(xpFormula(3, 3)).to.equal(0);
			expect(xpFormula(4, 3)).to.equal(0);
			expect(xpFormula(5, 3)).to.equal(0);
		});

		it('calculates base 10 correctly', () => {
			expect(xpFormula(0, 10)).to.equal(10);
			expect(xpFormula(1, 10)).to.equal(5);
			expect(xpFormula(2, 10)).to.equal(3);
			expect(xpFormula(3, 10)).to.equal(1);
			expect(xpFormula(4, 10)).to.equal(1);
			expect(xpFormula(5, 10)).to.equal(0);
		});
	});

	describe('calculateXP in 1:1 battles', () => {
		describe('calculate XP for winner', () => {
			it('assigns 13 XP if you kill a same level monster', () => {
				const constestant1 = {
					monster: {
						level: 1,
						givenName: 'fred'
					}
				};
				const constestant2 = {
					monster: {
						level: 1,
						displayLevel: 'level 1'
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP, reasons } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(13);
				expect(reasons).to.equal('Gained 10 XP for killing fred (same level)\nGained 3 XP for being the last one standing as a level 1 monster lasting 1 rounds in battle with fred (same level)');
			});

			it('assigns 23 XP if you kill a 1 level higher monster', () => {
				const constestant1 = {
					monster: {
						level: 2,
						givenName: 'fred'
					}
				};
				const constestant2 = {
					monster: {
						level: 1,
						displayLevel: 'level 1'
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP, reasons } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(23);
				expect(reasons).to.equal('Gained 20 XP for killing fred (1 level higher)\nGained 3 XP for being the last one standing as a level 1 monster lasting 1 rounds in battle with fred (1 level higher)');
			});

			it('assigns 7 XP if you kill a 1 level lower monster', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 2
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(7);
			});

			it('assigns no XP if you kill a monster that is 5 or more levels lower', () => {
				const constestant1 = {
					monster: {
						level: 0
					}
				};
				const constestant2 = {
					monster: {
						level: 6
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(0);
			});
		});

		describe('calculate XP for loser', () => {
			it('assigns 1 XP if level 1 monster is killed by same level monster', () => {
				const constestant1 = {
					monster: {
						level: 1,
						givenName: 'fred'
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP, reasons } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(1);
				expect(reasons).to.equal('Gained 1 XP for being killed by fred (same level)');
			});

			it('assigns no XP when you kill yourself', () => {
				const constestant1 = randomContestant();
				const constestant2 = randomContestant({ gender: 'androgynous' });
				constestant2.killedBy = constestant2.monster;

				const contestants = [constestant1, constestant2];

				const { gainedXP, reasons } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(0);
				expect(reasons).to.equal('Gained no XP for being killed by itself');
			});

			it('assigns 1 XP if level 100 monster is killed by same level monster', () => {
				const constestant1 = {
					monster: {
						level: 100
					}
				};
				const constestant2 = {
					monster: {
						level: 100
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(1);
			});

			it('assigns 1 XP if you are killed by 1 level lower monster', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 2
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(1);
			});

			it('assigns no XP if you are killed by 4 level lower monster', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 5
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(0);
			});

			it('assigns no XP if you are killed by 2 level lower monster', () => {
				const constestant1 = {
					monster: {
						level: 3
					}
				};
				const constestant2 = {
					monster: {
						level: 5
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(0);
			});

			it('assigns 1 XP if you are killed by 1 level higher monster', () => {
				const constestant1 = {
					monster: {
						level: 2
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(1);
			});

			it('assigns 2 XP if you are killed by 4 level higher monster after two rounds', () => {
				const constestant1 = {
					monster: {
						level: 5
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killedBy: constestant1.monster,
					rounds: 2
				};

				const contestants = [constestant1, constestant2];

				const { gainedXP } = calculateXP(constestant2, contestants);
				expect(gainedXP).to.equal(2);
			});
		});

		describe('calculate XP for flee', () => {
			it('assigns more xp to the monster that stays than the monster that flees', () => {
				const constestant1 = {
					monster: {
						level: 1,
						displayLevel: 'level 1',
						givenName: 'tom'
					}
				};
				const constestant2 = {
					monster: {
						level: 1,
						displayLevel: 'level 1',
						givenName: 'fred'
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP, reasons } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(3);
				expect(reasons).to.equal('Gained 3 XP for being the last one standing as a level 1 monster lasting 1 rounds in battle with fred (same level)');
				({ gainedXP, reasons } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(2);
				expect(reasons).to.equal('Gained 2 XP for fleeing as a level 1 monster lasting 1 rounds in battle with tom (same level)');
			});

			it('assigns more xp to the monster that stays when both are level 100', () => {
				const constestant1 = {
					monster: {
						level: 100
					}
				};
				const constestant2 = {
					monster: {
						level: 100
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(3);
				({ gainedXP } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(2);
			});

			it('assigns 3 xp if a monster 1 level higher flees you', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 2
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(3);
				({ gainedXP } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(1);
			});

			it('assigns 3 XP if a monster 4 levels higher flees you after 1 round', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 5
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(3);
				({ gainedXP } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(0);
			});

			it('assigns 9 XP if a monster 4 levels higher flees you after 3 rounds', () => {
				const constestant1 = {
					monster: {
						level: 1
					},
					rounds: 3
				};
				const constestant2 = {
					monster: {
						level: 5
					},
					fled: true,
					rounds: 3
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(9);
				({ gainedXP } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(0);
			});

			it('assigns 2 XP if you flee a monster 4 levels higher', () => {
				const constestant1 = {
					monster: {
						level: 5
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				let { gainedXP } = calculateXP(constestant1, contestants);
				expect(gainedXP).to.equal(0);
				({ gainedXP } = calculateXP(constestant2, contestants));
				expect(gainedXP).to.equal(2);
			});
		});
	});
	describe('calculateXP in 5:5 battles', () => {
		it('assigns proper xp to winners and losers if one beats all', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 1
				}
			};
			const constestant3 = {
				monster: {
					level: 1
				}
			};
			const constestant4 = {
				monster: {
					level: 1
				}
			};
			const constestant5 = {
				monster: {
					level: 1
				},
				killed: [
					constestant1.monster,
					constestant2.monster,
					constestant3.monster,
					constestant4.monster
				]
			};
			constestant1.killedBy = constestant5.monster;
			constestant2.killedBy = constestant5.monster;
			constestant3.killedBy = constestant5.monster;
			constestant4.killedBy = constestant5.monster;

			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(43);
		});

		it('assigns proper xp if 4 beat 1 all same level', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 1,
					givenName: 'fred'
				}
			};
			const constestant3 = {
				monster: {
					level: 1
				}
			};
			const constestant4 = {
				monster: {
					level: 1,
					givenName: 'sonka'
				}
			};
			const constestant5 = {
				monster: {
					level: 1
				}
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killedBy = constestant4.monster;
			constestant3.killed = [constestant2.monster];
			constestant4.killedBy = constestant5.monster;
			constestant4.killed = [constestant3.monster];
			constestant5.killed = [constestant4.monster];

			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP, reasons } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(11);
			({ gainedXP, reasons } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(11);
			expect(reasons).to.equal('Gained 10 XP for killing fred (same level)\nGained 1 XP for being killed by sonka (same level)');
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(11);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(13);
		});

		it('assigns proper xp to winners and losers if one beats all of all different levels', () => {
			const constestant1 = {
				monster: {
					level: 1,
					givenName: 'fred'
				},
				rounds: 3
			};
			const constestant2 = {
				monster: {
					level: 2,
					givenName: 'barney'
				}
			};
			const constestant3 = {
				monster: {
					level: 3,
					givenName: 'betty'
				},
				rounds: 2
			};
			const constestant4 = {
				monster: {
					level: 4,
					givenName: 'wilma'
				},
				rounds: 5
			};
			const constestant5 = {
				monster: {
					level: 5,
					displayLevel: 'level 5'
				},
				killed: [
					constestant1.monster,
					constestant2.monster,
					constestant3.monster,
					constestant4.monster
				],
				rounds: 5
			};
			constestant1.killedBy = constestant5.monster;
			constestant2.killedBy = constestant5.monster;
			constestant3.killedBy = constestant5.monster;
			constestant4.killedBy = constestant5.monster;

			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP, reasons } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(3);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP, reasons } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(11);
			expect(reasons).to.equal('Gained 1 XP for killing fred (4 levels lower)\nGained 1 XP for killing barney (3 levels lower)\nGained 3 XP for killing betty (2 levels lower)\nGained 5 XP for killing wilma (1 level lower)\nGained 1 XP for being the last one standing as a level 5 monster lasting 5 rounds in battle with 4 opponents at an average level of 3');
		});

		it('assigns proper xp if 4 beat 1 all different levels', () => {
			const constestant1 = {
				monster: {
					level: 1
				},
				rounds: 99
			};
			const constestant2 = {
				monster: {
					level: 2
				},
				rounds: 99
			};
			const constestant3 = {
				monster: {
					level: 3
				},
				rounds: 99
			};
			const constestant4 = {
				monster: {
					level: 4
				},
				rounds: 99
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				rounds: 99
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killedBy = constestant4.monster;
			constestant3.killed = [constestant2.monster];
			constestant4.killedBy = constestant5.monster;
			constestant4.killed = [constestant3.monster];
			constestant5.killed = [constestant4.monster];

			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(7);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(7);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(7);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(6);
		});

		it('assigns proper xp with mix of flee and kills all same level', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 1
				}
			};
			const constestant3 = {
				monster: {
					level: 1
				}
			};
			const constestant4 = {
				monster: {
					level: 1
				},
				fled: true
			};
			const constestant5 = {
				monster: {
					level: 1
				},
				fled: true
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killed = [constestant2.monster];


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(11);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(13);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(2);
		});

		it('assigns proper xp with mix of flee and kills all different levels', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 2
				}
			};
			const constestant3 = {
				monster: {
					level: 3
				}
			};
			const constestant4 = {
				monster: {
					level: 4
				},
				fled: true
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				fled: true
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killed = [constestant2.monster];


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(6);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(8);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(1);
		});

		it('assigns proper xp with flee all different levels after 1 round', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 2
				},
				fled: true
			};
			const constestant3 = {
				monster: {
					level: 3
				},
				fled: true
			};
			const constestant4 = {
				monster: {
					level: 4
				},
				fled: true
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				fled: true
			};


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(3);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(1);
		});

		it('assigns proper xp with flee all different levels after 3 rounds', () => {
			const constestant1 = {
				monster: {
					level: 1
				},
				rounds: 3
			};
			const constestant2 = {
				monster: {
					level: 2
				},
				fled: true,
				rounds: 3
			};
			const constestant3 = {
				monster: {
					level: 3
				},
				fled: true,
				rounds: 3
			};
			const constestant4 = {
				monster: {
					level: 4
				},
				fled: true,
				rounds: 3
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				fled: true,
				rounds: 3
			};


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			let { gainedXP } = calculateXP(constestant1, contestants);
			expect(gainedXP).to.equal(9);
			({ gainedXP } = calculateXP(constestant2, contestants));
			expect(gainedXP).to.equal(4);
			({ gainedXP } = calculateXP(constestant3, contestants));
			expect(gainedXP).to.equal(2);
			({ gainedXP } = calculateXP(constestant4, contestants));
			expect(gainedXP).to.equal(1);
			({ gainedXP } = calculateXP(constestant5, contestants));
			expect(gainedXP).to.equal(1);
		});
	});
});
