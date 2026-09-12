import "dotenv/config";
import bcrypt from "bcryptjs";
import { db, pool } from "@/db";
import { admins, teams, questions, eventSettings } from "@/db/schema";

async function main() {
  console.log("Seeding OUTPUT HUNT database...");

  // ---------------------------------------------------------------------
  // Admin account
  // ---------------------------------------------------------------------
  const adminUsername = "admin";
  const adminPassword = "OutputHunt@2026";
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await db
    .insert(admins)
    .values({ username: adminUsername, passwordHash, name: "Event Administrator" })
    .onConflictDoNothing();
  console.log(`Admin ready -> username: ${adminUsername} / password: ${adminPassword}`);

  // ---------------------------------------------------------------------
  // Event settings (single row)
  // ---------------------------------------------------------------------
  await db.insert(eventSettings).values({ id: 1 }).onConflictDoNothing();

  // ---------------------------------------------------------------------
  // Sample teams
  // ---------------------------------------------------------------------
  const sampleTeams = [
    {
      teamCode: "TEAM001",
      teamName: "Code Hunters",
      member1Name: "Arun Kumar",
      member2Name: "Divya S",
      member3Name: "Karthik R",
      member4Name: "Meena V",
      collegeDept: "CSE - Dept of Computer Science",
    },
    {
      teamCode: "TEAM002",
      teamName: "Debug Squad",
      member1Name: "Priya M",
      member2Name: "Suresh K",
      member3Name: "Nithya P",
      member4Name: "Vignesh T",
      collegeDept: "IT - Dept of Information Technology",
    },
    {
      teamCode: "TEAM003",
      teamName: "Byte Force",
      member1Name: "Harish B",
      member2Name: "Sowmya R",
      member3Name: "Dinesh A",
      member4Name: "Lakshmi N",
      collegeDept: "ECE - Dept of Electronics",
    },
    {
      teamCode: "TEAM004",
      teamName: "Segfault Squad",
      member1Name: "Ramesh V",
      member2Name: "Anitha K",
      member3Name: "Gokul S",
      member4Name: "Bhavani R",
      collegeDept: "CSE - Dept of Computer Science",
    },
    {
      teamCode: "TEAM005",
      teamName: "Null Pointers",
      member1Name: "Vikram J",
      member2Name: "Deepa L",
      member3Name: "Sathish M",
      member4Name: "Kavya S",
      collegeDept: "AIML - Dept of AI & ML",
    },
  ];

  for (const t of sampleTeams) {
    await db.insert(teams).values(t).onConflictDoNothing();
  }
  console.log(`Seeded ${sampleTeams.length} sample teams (TEAM001-TEAM005).`);

  // ---------------------------------------------------------------------
  // Wipe & reseed questions so this script is safely re-runnable
  // ---------------------------------------------------------------------
  await db.delete(questions);

  type NewQuestion = typeof questions.$inferInsert;
  const round1: NewQuestion[] = [
    // ---------------- C ----------------
    {
      round: 1, language: "C", difficulty: "BASIC", orderIndex: 1,
      code: `#include <stdio.h>\nint main() {\n    int a = 5, b = 2;\n    printf("%d\\n", a / b);\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "2", optionB: "2.5", optionC: "2.0", optionD: "3",
      correctOption: "A",
      explanation: "Both operands are int, so / performs integer division: 5/2 truncates to 2.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "C", difficulty: "BASIC", orderIndex: 2,
      code: `#include <stdio.h>\nint main() {\n    int i;\n    for (i = 0; i < 3; i++) {\n        printf("%d ", i);\n    }\n    printf("%d", i);\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "0 1 2 3", optionB: "0 1 2", optionC: "1 2 3", optionD: "0 1 2 3 4",
      correctOption: "A",
      explanation: "The loop prints 0,1,2 then exits when i becomes 3; that final value of i is printed too.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "C", difficulty: "BASIC", orderIndex: 3,
      code: `#include <stdio.h>\nint main() {\n    int a = 10, b = 5, c = 2;\n    int result = a + b * c;\n    printf("%d\\n", result);\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "20", optionB: "30", optionC: "25", optionD: "17",
      correctOption: "A",
      explanation: "Multiplication has higher precedence than addition: 10 + (5*2) = 20.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "C", difficulty: "BASIC", orderIndex: 4,
      code: `#include <stdio.h>\nint main() {\n    int a = 5;\n    if (a = 0)\n        printf("Yes\\n");\n    else\n        printf("No\\n");\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "No", optionB: "Yes", optionC: "Compilation Error", optionD: "YesNo",
      correctOption: "A",
      explanation: "'a = 0' is an assignment, not a comparison. It assigns 0 to a, which is falsy, so the else branch runs.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "C", difficulty: "BASIC", orderIndex: 5,
      code: `#include <stdio.h>\nint main() {\n    char str[] = "Hello";\n    printf("%c\\n", str[1]);\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "e", optionB: "H", optionC: "l", optionD: "He",
      correctOption: "A",
      explanation: "String indexing is zero-based, so str[1] is the second character, 'e'.",
      marks: 1, negativeMarks: 0,
    },
    // ---------------- C++ ----------------
    {
      round: 1, language: "CPP", difficulty: "BASIC", orderIndex: 6,
      code: `#include <iostream>\nusing namespace std;\nvoid update(int &x) {\n    x = x * 2;\n}\nint main() {\n    int a = 4;\n    update(a);\n    cout << a << endl;\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "8", optionB: "4", optionC: "16", optionD: "0",
      correctOption: "A",
      explanation: "The parameter is a reference (&x), so update() modifies the original variable a directly.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "CPP", difficulty: "BASIC", orderIndex: 7,
      code: `#include <iostream>\nusing namespace std;\nint main() {\n    int i = 0;\n    while (i < 5) {\n        cout << i++ << " ";\n    }\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "0 1 2 3 4", optionB: "1 2 3 4 5", optionC: "0 1 2 3 4 5", optionD: "1 2 3 4",
      correctOption: "A",
      explanation: "i++ prints the current value of i (post-increment) before increasing it, starting at 0 and stopping before 5.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "CPP", difficulty: "BASIC", orderIndex: 8,
      code: `#include <iostream>\nusing namespace std;\nint add(int a, int b = 10) {\n    return a + b;\n}\nint main() {\n    cout << add(5) << " " << add(5, 20);\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "15 25", optionB: "5 10", optionC: "15 20", optionD: "25 15",
      correctOption: "A",
      explanation: "add(5) uses the default b=10 giving 15; add(5,20) overrides the default giving 25.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "CPP", difficulty: "BASIC", orderIndex: 9,
      code: `#include <iostream>\nusing namespace std;\nint main() {\n    int a = 7, b = 2;\n    double result = (double)a / b;\n    cout << result;\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "3.5", optionB: "3", optionC: "3.0", optionD: "4",
      correctOption: "A",
      explanation: "Casting a to double before division forces floating point division: 7.0/2 = 3.5.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "CPP", difficulty: "BASIC", orderIndex: 10,
      code: `#include <iostream>\nusing namespace std;\nclass Counter {\npublic:\n    int count;\n    Counter() { count = 0; }\n    void increment() { count++; }\n};\nint main() {\n    Counter c1, c2;\n    c1.increment();\n    c1.increment();\n    c2.increment();\n    cout << c1.count << " " << c2.count;\n    return 0;\n}`,
      questionText: "What will be the output of this program?",
      optionA: "2 1", optionB: "1 2", optionC: "3 0", optionD: "2 2",
      correctOption: "A",
      explanation: "Each object has its own count member; c1 is incremented twice (2), c2 once (1).",
      marks: 1, negativeMarks: 0,
    },
    // ---------------- Python ----------------
    {
      round: 1, language: "PYTHON", difficulty: "BASIC", orderIndex: 11,
      code: `nums = [10, 20, 30, 40, 50]\nprint(nums[1:4])`,
      questionText: "What will be the output of this program?",
      optionA: "[20, 30, 40]", optionB: "[10, 20, 30]", optionC: "[20, 30, 40, 50]", optionD: "[30, 40]",
      correctOption: "A",
      explanation: "Slicing nums[1:4] includes indices 1,2,3 (stop index 4 is excluded): 20,30,40.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "PYTHON", difficulty: "BASIC", orderIndex: 12,
      code: `x = 5\ny = 2\nprint(x // y, x % y, x / y)`,
      questionText: "What will be the output of this program?",
      optionA: "2 1 2.5", optionB: "2.5 1 2", optionC: "2 1 2", optionD: "2 2 1",
      correctOption: "A",
      explanation: "// is floor division (2), % is remainder (1), / is true division giving a float (2.5).",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "PYTHON", difficulty: "BASIC", orderIndex: 13,
      code: `total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)`,
      questionText: "What will be the output of this program?",
      optionA: "10", optionB: "15", optionC: "9", optionD: "14",
      correctOption: "A",
      explanation: "range(1,5) produces 1,2,3,4; their sum is 10.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "PYTHON", difficulty: "BASIC", orderIndex: 14,
      code: `a = "ab"\nb = a * 3\nprint(b)`,
      questionText: "What will be the output of this program?",
      optionA: "ababab", optionB: "abab", optionC: "ababababab", optionD: "TypeError",
      correctOption: "A",
      explanation: "Multiplying a string by an integer repeats it that many times: 'ab' * 3 = 'ababab'.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "PYTHON", difficulty: "BASIC", orderIndex: 15,
      code: `def greet(name="World"):\n    return "Hello, " + name\n\nprint(greet(), greet("Python"))`,
      questionText: "What will be the output of this program?",
      optionA: "Hello, World Hello, Python", optionB: "Hello, Hello, World Python", optionC: "Hello, World, Hello, Python", optionD: "Hello World Hello Python",
      correctOption: "A",
      explanation: "greet() uses the default 'World'; greet('Python') overrides it. Both results are printed separated by a space.",
      marks: 1, negativeMarks: 0,
    },
    // ---------------- HTML ----------------
    {
      round: 1, language: "HTML", difficulty: "BASIC", orderIndex: 16,
      code: `<p>Hello &amp; welcome to <strong>OUTPUT HUNT</strong>!</p>`,
      questionText: "What text will actually be visible when this HTML is rendered in a browser?",
      optionA: "Hello & welcome to OUTPUT HUNT!", optionB: "Hello &amp; welcome to OUTPUT HUNT!", optionC: "Hello and welcome to OUTPUT HUNT!", optionD: "Hello & welcome to <strong>OUTPUT HUNT</strong>!",
      correctOption: "A",
      explanation: "&amp; is the HTML entity for '&', and tags like <strong> only affect styling, not the visible text.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "HTML", difficulty: "BASIC", orderIndex: 17,
      code: `<p>Hello        World</p>`,
      questionText: "What text will actually be visible when this HTML is rendered in a browser?",
      optionA: "Hello World", optionB: "Hello        World", optionC: "HelloWorld", optionD: "Hello  World",
      correctOption: "A",
      explanation: "Browsers collapse any sequence of whitespace in HTML text into a single space when rendering.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "HTML", difficulty: "BASIC", orderIndex: 18,
      code: `<ol start="3">\n  <li>Apple</li>\n  <li>Banana</li>\n  <li>Cherry</li>\n</ol>`,
      questionText: "What numbers will precede each list item when rendered?",
      optionA: "3, 4, 5", optionB: "1, 2, 3", optionC: "3, 3, 3", optionD: "0, 1, 2",
      correctOption: "A",
      explanation: "The start attribute sets the first item's number to 3, and numbering continues sequentially.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "HTML", difficulty: "BASIC", orderIndex: 19,
      code: `<input type="text" value="OutputHunt" disabled>`,
      questionText: "What value is shown, and can the user edit this field?",
      optionA: "Shows \"OutputHunt\"; field is not editable", optionB: "Shows empty field; field is editable", optionC: "Shows \"OutputHunt\"; field is editable", optionD: "Shows empty field; field is not editable",
      correctOption: "A",
      explanation: "The value attribute pre-fills the field, and the disabled attribute prevents user interaction.",
      marks: 1, negativeMarks: 0,
    },
    {
      round: 1, language: "HTML", difficulty: "BASIC", orderIndex: 20,
      code: `<p>Score: <!-- 100 --> 95</p>`,
      questionText: "What text will actually be visible when this HTML is rendered in a browser?",
      optionA: "Score: 95", optionB: "Score: 100 95", optionC: "Score: <!-- 100 --> 95", optionD: "Score: 100",
      correctOption: "A",
      explanation: "HTML comments are not rendered as visible text, so only 'Score: 95' appears (extra space collapses).",
      marks: 1, negativeMarks: 0,
    },
  ];

  const round2: NewQuestion[] = [
    {
      round: 2, language: "C", difficulty: "ADVANCED", orderIndex: 1,
      code: `#include <stdio.h>\n\n// Returns an incrementing counter value.\n// The static variable retains its value\n// between multiple calls to this function.\nint counter() {\n    static int count = 0;\n    count += 2;\n    return count;\n}\n\nint sumFirstN(int n) {\n    int sum = 0;\n    for (int i = 1; i <= n; i++) {\n        sum += i;\n    }\n    return sum;\n}\n\nint main() {\n    int total = 0;\n\n    for (int i = 0; i < 4; i++) {\n        total += counter();\n    }\n\n    int extra = sumFirstN(3);\n\n    printf("Total=%d Last=%d\\n", total, counter());\n    printf("Extra=%d\\n", extra);\n\n    return 0;\n}`,
      questionText: "What is printed? (lines joined here with ' | ')",
      optionA: "Total=20 Last=10 | Extra=6", optionB: "Total=20 Last=8 | Extra=6", optionC: "Total=8 Last=10 | Extra=6", optionD: "Total=20 Last=10 | Extra=3",
      correctOption: "A",
      explanation: "counter() is called 5 times total, each adding 2 to a static variable: 2,4,6,8 (sum=20 in the loop), then the 5th call returns 10. sumFirstN(3)=1+2+3=6.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "C", difficulty: "ADVANCED", orderIndex: 2,
      code: `#include <stdio.h>\n\nvoid modifyArray(int *arr, int size) {\n    for (int i = 0; i < size; i++) {\n        *(arr + i) = *(arr + i) * 2;\n    }\n}\n\nint sumArray(int *arr, int size) {\n    int sum = 0;\n    for (int i = 0; i < size; i++) {\n        sum += arr[i];\n    }\n    return sum;\n}\n\nint main() {\n    int numbers[5] = {1, 2, 3, 4, 5};\n    int *ptr = numbers;\n\n    modifyArray(ptr, 5);\n\n    printf("Array: ");\n    for (int i = 0; i < 5; i++) {\n        printf("%d ", numbers[i]);\n    }\n    printf("\\n");\n\n    int total = sumArray(numbers, 5);\n    printf("Sum: %d\\n", total);\n\n    return 0;\n}`,
      questionText: "What is printed? (lines joined here with ' | ')",
      optionA: "Array: 2 4 6 8 10 | Sum: 30", optionB: "Array: 1 2 3 4 5 | Sum: 30", optionC: "Array: 2 4 6 8 10 | Sum: 15", optionD: "Array: 1 2 3 4 5 | Sum: 15",
      correctOption: "A",
      explanation: "Arrays decay to pointers, so modifyArray changes the original array in place (doubles each value), and sumArray sums the already-modified values.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "C", difficulty: "ADVANCED", orderIndex: 3,
      code: `#include <stdio.h>\n\nstruct Student {\n    char name[20];\n    int marks;\n};\n\nint main() {\n    struct Student students[3] = {\n        {"Anu", 78},\n        {"Ravi", 92},\n        {"Kiran", 85}\n    };\n\n    int highestIndex = 0;\n    for (int i = 1; i < 3; i++) {\n        if (students[i].marks > students[highestIndex].marks) {\n            highestIndex = i;\n        }\n    }\n\n    int total = 0;\n    for (int i = 0; i < 3; i++) {\n        total += students[i].marks;\n    }\n\n    printf("Topper: %s\\n", students[highestIndex].name);\n    printf("Average: %d\\n", total / 3);\n\n    return 0;\n}`,
      questionText: "What is printed? (lines joined here with ' | ')",
      optionA: "Topper: Ravi | Average: 85", optionB: "Topper: Kiran | Average: 85", optionC: "Topper: Ravi | Average: 85.0", optionD: "Topper: Ravi | Average: 84",
      correctOption: "A",
      explanation: "Ravi has the highest marks (92). Total = 78+92+85 = 255, and 255/3 with integer division is exactly 85.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "CPP", difficulty: "ADVANCED", orderIndex: 4,
      code: `#include <iostream>\nusing namespace std;\n\nclass Shape {\npublic:\n    virtual int area() {\n        return 0;\n    }\n    virtual void describe() {\n        cout << "Shape with area " << area() << endl;\n    }\n};\n\nclass Square : public Shape {\nprivate:\n    int side;\npublic:\n    Square(int s) : side(s) {}\n    int area() override {\n        return side * side;\n    }\n};\n\nclass Rectangle : public Shape {\nprivate:\n    int width, height;\npublic:\n    Rectangle(int w, int h) : width(w), height(h) {}\n    int area() override {\n        return width * height;\n    }\n};\n\nint main() {\n    Shape* shapes[2];\n    shapes[0] = new Square(4);\n    shapes[1] = new Rectangle(3, 5);\n\n    for (int i = 0; i < 2; i++) {\n        shapes[i]->describe();\n    }\n\n    return 0;\n}`,
      questionText: "What is printed? (lines joined here with ' | ')",
      optionA: "Shape with area 16 | Shape with area 15", optionB: "Shape with area 0 | Shape with area 0", optionC: "Shape with area 15 | Shape with area 16", optionD: "Shape with area 16 | Shape with area 8",
      correctOption: "A",
      explanation: "Virtual functions enable dynamic dispatch: describe() calls the overridden area() for each derived class. Square: 4*4=16, Rectangle: 3*5=15.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "CPP", difficulty: "ADVANCED", orderIndex: 5,
      code: `#include <iostream>\nusing namespace std;\n\nint divide(int a, int b) {\n    if (b == 0) {\n        throw runtime_error("Division by zero");\n    }\n    return a / b;\n}\n\nint main() {\n    int values[] = {10, 20, 0, 5};\n    int total = 0;\n\n    for (int i = 0; i < 4; i++) {\n        try {\n            int result = divide(100, values[i]);\n            total += result;\n            cout << "Result: " << result << endl;\n        } catch (const exception& e) {\n            cout << "Caught: " << e.what() << endl;\n            total += 1;\n        }\n    }\n\n    cout << "Total: " << total << endl;\n    return 0;\n}`,
      questionText: "What is the final value printed for Total?",
      optionA: "36", optionB: "35", optionC: "16", optionD: "Program crashes (unhandled exception)",
      correctOption: "A",
      explanation: "100/10=10, 100/20=5, 100/0 throws (caught, adds 1), 100/5=20. Total = 10+5+1+20 = 36.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "PYTHON", difficulty: "ADVANCED", orderIndex: 6,
      code: `def make_multipliers():\n    multipliers = []\n    for i in range(3):\n        multipliers.append(lambda x: x * i)\n    return multipliers\n\n\ndef main():\n    funcs = make_multipliers()\n    results = [f(10) for f in funcs]\n    print(results)\n\n\nmain()`,
      questionText: "What will be the output of this program?",
      optionA: "[20, 20, 20]", optionB: "[0, 10, 20]", optionC: "[0, 0, 0]", optionD: "[30, 30, 30]",
      correctOption: "A",
      explanation: "All lambdas capture the same variable i by reference (late binding), not its value at creation. After the loop, i=2, so every call returns x*2.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "PYTHON", difficulty: "ADVANCED", orderIndex: 7,
      code: `def add_item(item, basket=[]):\n    basket.append(item)\n    return basket\n\n\ndef process_orders():\n    order1 = add_item("apple")\n    order2 = add_item("banana")\n    order3 = add_item("cherry", [])\n    return order1, order2, order3\n\n\nresult1, result2, result3 = process_orders()\nprint(result1)\nprint(result2)\nprint(result3)`,
      questionText: "What is printed? (lines joined here with ' | ')",
      optionA: "['apple', 'banana'] | ['apple', 'banana'] | ['cherry']", optionB: "['apple'] | ['banana'] | ['cherry']", optionC: "['apple', 'banana', 'cherry'] | ['apple', 'banana', 'cherry'] | ['apple', 'banana', 'cherry']", optionD: "['apple'] | ['apple', 'banana'] | ['cherry']",
      correctOption: "A",
      explanation: "Mutable default arguments are created once, at function definition time, and shared across calls that don't override it. order1 and order2 reference the same shared list.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "PYTHON", difficulty: "ADVANCED", orderIndex: 8,
      code: `def counter_gen(n):\n    total = 0\n    for i in range(1, n + 1):\n        total += i\n        yield total\n\n\ndef process(n):\n    gen = counter_gen(n)\n    results = []\n    for value in gen:\n        if value % 2 == 0:\n            results.append(value)\n    return results\n\n\noutput = process(6)\nprint(output)`,
      questionText: "What will be the output of this program?",
      optionA: "[6, 10]", optionB: "[1, 3, 6, 10, 15, 21]", optionC: "[2, 4, 6]", optionD: "[6, 10, 15]",
      correctOption: "A",
      explanation: "The generator yields cumulative sums 1,3,6,10,15,21. Only the even values (6 and 10) are kept.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "HTML", difficulty: "ADVANCED", orderIndex: 9,
      code: `<table border="1">\n  <tr>\n    <th>Item</th>\n    <th colspan="2">Details</th>\n  </tr>\n  <tr>\n    <td>Pen</td>\n    <td>Blue</td>\n    <td>10</td>\n  </tr>\n  <tr>\n    <td>Book</td>\n    <td colspan="2">Notebook - 200 pages</td>\n  </tr>\n</table>`,
      questionText: "How many columns does the header row visually span, and how many <td> cells are declared in the Pen row?",
      optionA: "Header spans 3 columns; Pen row has 3 cells", optionB: "Header spans 2 columns; Pen row has 3 cells", optionC: "Header spans 3 columns; Pen row has 2 cells", optionD: "Header spans 3 columns; Pen row has 4 cells",
      correctOption: "A",
      explanation: "\"Item\" (1 column) + \"Details\" colspan=2 (2 columns) = 3 columns total. The Pen row explicitly declares three <td> cells.",
      marks: 2, negativeMarks: 1,
    },
    {
      round: 2, language: "HTML", difficulty: "ADVANCED", orderIndex: 10,
      code: `<!DOCTYPE html>\n<html>\n<head>\n  <title>Output Hunt</title>\n</head>\n<body>\n  <div id="box">\n    <p>Original <b>Content</b></p>\n  </div>\n\n  <script>\n    const box = document.getElementById("box");\n    const text = box.textContent;\n    box.innerHTML = "<i>" + text.trim() + "</i>";\n    document.write(box.textContent);\n  </script>\n</body>\n</html>`,
      questionText: "What text does document.write() output?",
      optionA: "Original Content", optionB: "<i>Original Content</i>", optionC: "Original <b>Content</b>", optionD: "OriginalContent",
      correctOption: "A",
      explanation: "textContent returns only the text of all descendant nodes without tags. After replacing innerHTML with an <i> wrapper, textContent is still just the plain text 'Original Content'.",
      marks: 2, negativeMarks: 1,
    },
  ];

  await db.insert(questions).values([...round1, ...round2]);
  console.log(`Seeded ${round1.length} Round 1 questions and ${round2.length} Round 2 questions.`);

  console.log("Seeding complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
