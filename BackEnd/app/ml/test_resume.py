from resume_matcher import analyze_resume

resume_text = """
Name: Nattapong R.
Position: IT Support Specialist

Summary:
IT support professional with experience in troubleshooting hardware and software issues.

Skills:
- Windows troubleshooting
- Network setup
- Printer configuration
- Customer support
- Basic scripting (batch)

Experience:
- Provided technical support for office staff
- Installed and maintained computer systems
- Resolved network connectivity issues

Projects:
- Internal IT documentation system

Education:
Diploma in Information Technology
"""

job_description = """
Position: Frontend Developer

Requirements:
- React / TypeScript
- REST API integration
- Firebase
- UI/UX understanding
- 1-3 years experience
"""

result = analyze_resume(resume_text, job_description)

print("RESULT:")
print(result)