import inquirer from 'inquirer';
async function run() {
  const answers = await inquirer.prompt([
    { type: 'input', name: 'q', message: 'test' }
  ]);
  console.log(answers);
}
run();
