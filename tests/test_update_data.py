import importlib.util,unittest,datetime as dt
from pathlib import Path
spec=importlib.util.spec_from_file_location('update',Path(__file__).resolve().parents[1]/'scripts/update_data.py')
u=importlib.util.module_from_spec(spec);spec.loader.exec_module(u)

class AdjustmentTests(unittest.TestCase):
    def setUp(self):
        self.d=[dt.date(2026,9,x) for x in [16,17,18]]
        self.quotes={d:(i,0) for i,d in enumerate(self.d)}
        self.q={'close':[106.9,None,109.85]};self.a=[106.9,None,109.85]
    def test_null_interior(self):
        self.assertEqual(u.adjustment_for(self.d[1],self.quotes,self.q,self.a,set()),(1.,True))
    def test_missing_row(self):
        del self.quotes[self.d[1]]
        self.assertEqual(u.adjustment_for(self.d[1],self.quotes,self.q,self.a,set()),(1.,True))
    def test_action_blocks_fill(self):
        with self.assertRaises(ValueError):u.adjustment_for(self.d[1],self.quotes,self.q,self.a,{self.d[1]})
    def test_changed_factor_blocks_fill(self):
        self.a[2]=100
        with self.assertRaises(ValueError):u.adjustment_for(self.d[1],self.quotes,self.q,self.a,set())
    def test_no_right_neighbour_blocks_fill(self):
        self.a[2]=None
        with self.assertRaises(ValueError):u.adjustment_for(self.d[1],self.quotes,self.q,self.a,set())
    def test_existing_factor(self):
        self.assertEqual(u.adjustment_for(self.d[0],self.quotes,self.q,self.a,set()),(1.,False))

if __name__=='__main__':unittest.main()
