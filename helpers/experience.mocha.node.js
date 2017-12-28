const { expect } = require('../shared/test-setup');

const { calculateXP } = require('./experience');

describe('./helpers/experience.js', () => {
	// didn't have time to look up how to stub these out as reminders, this works...
	describe('xpFormula works', () => {
		it('words', () => {
			expect(true).to.be.false;
		})
	});
	describe('getAverageLevel works', () => {
		it('words', () => {
			expect(true).to.be.false;
		})
	})
	describe('calculateXP in 1:1 battles', () => {
		describe('calculate XP for winner', () => {
			it('assigns 13 XP if you kill a same level monster', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				expect(calculateXP(constestant2, contestants)).to.equal(13);
			});

			it('assigns 25 XP if you kill a 1 level higher monster', () => {
				const constestant1 = {
					monster: {
						level: 2
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killed: [constestant1.monster]
				};

				const contestants = [constestant1, constestant2];

				expect(calculateXP(constestant2, contestants)).to.equal(25);
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

				expect(calculateXP(constestant2, contestants)).to.equal(7);
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

				expect(calculateXP(constestant2, contestants)).to.equal(0);
			});
		});

		describe('calculate XP for loser', () => {
			it('assigns 1 XP if level 1 monster is killed by same level monster', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				expect(calculateXP(constestant2, contestants)).to.equal(1);
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

				expect(calculateXP(constestant2, contestants)).to.equal(1);
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

				expect(calculateXP(constestant2, contestants)).to.equal(1);
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

				expect(calculateXP(constestant2, contestants)).to.equal(0);
			});

			it('assigns 2 XP if you are killed by 1 level higher monster', () => {
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

				expect(calculateXP(constestant2, contestants)).to.equal(2);
			});

			it('assigns 16 XP if you are killed by 4 level higher monster', () => {
				const constestant1 = {
					monster: {
						level: 5
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					killedBy: constestant1.monster
				};

				const contestants = [constestant1, constestant2];

				expect(calculateXP(constestant2, contestants)).to.equal(16);
			});
		});

		describe('calculate XP for flee', () => {
			it('assigns more xp to the monster that stays than the monster that flees', () => {
				const constestant1 = {
					monster: {
						level: 1
					}
				};
				const constestant2 = {
					monster: {
						level: 1
					},
					fled: true
				};

				const contestants = [constestant1, constestant2];

				expect(calculateXP(constestant1, contestants)).to.equal(3);
				expect(calculateXP(constestant2, contestants)).to.equal(2);
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

				expect(calculateXP(constestant1, contestants)).to.equal(3);
				expect(calculateXP(constestant2, contestants)).to.equal(2);
			});

			it('assigns 5 xp if a monster 1 level higher flees you', () => {
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

				expect(calculateXP(constestant1, contestants)).to.equal(5);
				expect(calculateXP(constestant2, contestants)).to.equal(1);
			});

			it('assigns 5 XP if a monster 4 levels higher flees you after 1 round', () => {
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

				expect(calculateXP(constestant1, contestants)).to.equal(5);
				expect(calculateXP(constestant2, contestants)).to.equal(0);
			});

			it('assigns 15 XP if a monster 4 levels higher flees you after 3 rounds', () => {
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

				expect(calculateXP(constestant1, contestants)).to.equal(15);
				expect(calculateXP(constestant2, contestants)).to.equal(0);
			});

			it('assigns 5 XP if you flee a monster 4 levels higher', () => {
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

				expect(calculateXP(constestant1, contestants)).to.equal(0);
				expect(calculateXP(constestant2, contestants)).to.equal(5);
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

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(1);
			expect(calculateXP(constestant3, contestants)).to.equal(1);
			expect(calculateXP(constestant4, contestants)).to.equal(1);
			expect(calculateXP(constestant5, contestants)).to.equal(43);
		});

		it('assigns proper xp if 4 beat 1 all same level', () => {
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

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(11);
			expect(calculateXP(constestant3, contestants)).to.equal(11);
			expect(calculateXP(constestant4, contestants)).to.equal(11);
			expect(calculateXP(constestant5, contestants)).to.equal(13);
		});

		it('assigns proper xp to winners and losers if one beats all all different levels', () => {
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
				}
			};
			const constestant5 = {
				monster: {
					level: 5
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

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(1);
			expect(calculateXP(constestant3, contestants)).to.equal(1);
			expect(calculateXP(constestant4, contestants)).to.equal(1);
			expect(calculateXP(constestant5, contestants)).to.equal(43);
		});

		it('assigns proper xp if 4 beat 1 all different levels', () => {
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
				}
			};
			const constestant5 = {
				monster: {
					level: 5
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

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(11);
			expect(calculateXP(constestant3, contestants)).to.equal(11);
			expect(calculateXP(constestant4, contestants)).to.equal(11);
			expect(calculateXP(constestant5, contestants)).to.equal(13);
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
				flee: true
			};
			const constestant5 = {
				monster: {
					level: 1
				},
				flee: true
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killed = [constestant2.monster];


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(11);
			expect(calculateXP(constestant3, contestants)).to.equal(11);
			expect(calculateXP(constestant4, contestants)).to.equal(11);
			expect(calculateXP(constestant5, contestants)).to.equal(13);
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
				flee: true
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				flee: true
			};
			constestant1.killedBy = constestant2.monster;
			constestant2.killedBy = constestant3.monster;
			constestant2.killed = [constestant1.monster];
			constestant3.killed = [constestant2.monster];


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(11);
			expect(calculateXP(constestant3, contestants)).to.equal(11);
			expect(calculateXP(constestant4, contestants)).to.equal(11);
			expect(calculateXP(constestant5, contestants)).to.equal(13);
		});

		it('assigns proper xp with flee all different levels', () => {
			const constestant1 = {
				monster: {
					level: 1
				}
			};
			const constestant2 = {
				monster: {
					level: 2
				},
				flee: true
			};
			const constestant3 = {
				monster: {
					level: 3
				},
				flee: true
			};
			const constestant4 = {
				monster: {
					level: 4
				},
				flee: true
			};
			const constestant5 = {
				monster: {
					level: 5
				},
				flee: true
			};


			const contestants = [constestant1, constestant2, constestant3, constestant4, constestant5];

			expect(calculateXP(constestant1, contestants)).to.equal(1);
			expect(calculateXP(constestant2, contestants)).to.equal(11);
			expect(calculateXP(constestant3, contestants)).to.equal(11);
			expect(calculateXP(constestant4, contestants)).to.equal(11);
			expect(calculateXP(constestant5, contestants)).to.equal(13);
		});
	});
});
