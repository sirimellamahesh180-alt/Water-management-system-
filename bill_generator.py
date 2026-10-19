import sys
import json
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib import colors

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_number(num_pages)
            super().showPage()
        super().save()

    def draw_page_number(self, page_count):
        self.saveState()
        self.setFont("Helvetica", 9)
        self.setFillColor(colors.HexColor("#475569"))
        self.drawRightString(A4[0] - 40, 30, f"Page {self._pageNumber} of {page_count}")
        self.drawString(40, 30, "Water Management System - Official Statement")
        self.restoreState()

def generate_pdf():
    try:
        # Read JSON string passed from Node.js spawn('python', [..., JSON.stringify(newBill)])
        if len(sys.argv) < 2:
            return
        
        bill_data = json.loads(sys.argv[1])
        
        bill_id = bill_data.get('id', 'WM-0000')
        name = bill_data.get('name', 'Customer')
        phone = bill_data.get('phone', '')
        prev_reading = bill_data.get('prev', 0)
        curr_reading = bill_data.get('curr', 0)
        litres = bill_data.get('litres', 0)
        rate = bill_data.get('rate', 0.015)
        total = bill_data.get('total', 0)
        bill_date = bill_data.get('date', '')

        output_dir = os.path.join(os.path.dirname(__file__), 'generated_pdfs')
        os.makedirs(output_dir, exist_ok=True)
        pdf_path = os.path.join(output_dir, f"Bill_{bill_id}.pdf")

        # Create PDF using ReportLab
        c = canvas.Canvas(pdf_path, pagesize=A4)
        width, height = A4

        # Header Box & Branding
        c.setFillColor(colors.HexColor("#2563eb"))
        c.rect(40, height - 100, width - 80, 60, fill=1, stroke=0)
        
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 20)
        c.drawString(60, height - 65, "WATER MANAGEMENT SYSTEM")
        
        c.setFont("Helvetica", 10)
        c.drawRightString(width - 60, height - 65, f"Date: {bill_date}")

        # Customer Details Section
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 14)
        c.drawString(40, height - 140, "Invoice & Customer Details")

        c.setFont("Helvetica", 11)
        c.drawString(40, height - 170, f"Bill ID: {bill_id}")
        c.drawString(40, height - 190, f"Customer Name: {name}")
        c.drawString(40, height - 210, f"Phone Number: +91 {phone}")

        # Table Header
        c.setFillColor(colors.HexColor("#f1f5f9"))
        c.rect(40, height - 280, width - 80, 30, fill=1, stroke=1)
        c.setFillColor(colors.HexColor("#0f172a"))
        c.setFont("Helvetica-Bold", 10)
        c.drawString(55, height - 262, "Description")
        c.drawString(280, height - 262, "Consumption / Units")
        c.drawString(420, height - 262, "Amount (₹)")

        # Table Row
        c.setFont("Helvetica", 10)
        c.drawString(55, height - 310, "Water Consumption Charges")
        c.drawString(280, height - 310, f"{litres} Litres (Prev: {prev_reading} | Curr: {curr_reading})")
        c.drawString(420, height - 310, f"₹{total:.2f}")

        # Total Payable Box
        c.setStrokeColor(colors.HexColor("#cbd5e1"))
        c.line(40, height - 350, width - 40, height - 350)

        c.setFont("Helvetica-Bold", 14)
        c.drawString(320, height - 390, "Total Payable:")
        c.setFillColor(colors.HexColor("#2563eb"))
        c.drawString(430, height - 390, f"₹{total:.2f}")

        # Footer notes
        c.setFillColor(colors.HexColor("#64748b"))
        c.setFont("Helvetica", 9)
        c.drawString(40, 80, "Thank you for using the Natively Hosted Water Management System.")
        c.drawString(40, 65, "This is a computer-generated official billing document.")

        c.showPage()
        c.save()
        print(f"PDF successfully generated at: {pdf_path}")

    except Exception as e:
        print(f"Error generating PDF: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    generate_pdf()
